const AWS = require("aws-sdk");
const superagent = require("superagent");
const avp = new AWS.Service({
  apiConfig: require("./verifiedpermissions.json"),
});
const ssm = new (require("aws-sdk/clients/ssm"))();

const { CognitoJwtVerifier } = require("aws-jwt-verify");
const jwtVerifier = CognitoJwtVerifier.create({
  userPoolId: process.env.USERPOOLID,
  tokenUse: "id",
  clientId: process.env.APPCLIENTID,
});

const policyStoreId = process.env.POLICYSTOREID;
const apiStorePath = "admin/store";
const apiFranchisePath = "admin/franchise";
let apiRootUrl, apiKey;

/**
 * @type {import('@types/aws-lambda').APIGatewayProxyHandler}
 */
exports.handler = async (event) => {
  /**
    Define entities structure, this represents the supplementary data to be passed to authorization engine as part of every authorization query
    Entities list include information about users, groups, actions and relationships between these entities, this data is used to guide authorization engine
    This is the initial list of hard-coded entities, in real-world scenarios, these entities will be combination of backend data from database, runtime data
    from application context of environment in addition to user/groups data from user's security token.
    */
  let entities = {
    entityList: [],
  };
  /**
    Extract and verify authorization token, this also parses the token data payload
    */
  const token = event.headers["Authorization"];
  let payload;
  try {
    payload = await jwtVerifier.verify(token);
    var groups = payload["cognito:groups"] || [];
    var franchises = payload["custom:franchiseCode"]?.split(",") || "";
    var stores = payload["custom:employmentStoreCode"]?.split(",") || "";

    //add user (principal information) to entities list
    var userEntity = {
      identifier: {
        entityType: "MyApplication::User",
        entityId: payload["cognito:username"],
      },
      attributes: {
        employmentStoreCodes: { set: [] },
        employmentStoreFranchiseCodes: { set: [] },
      },
      parents: [],
    };

    const params = await ssm.getParameters({
        Names: ["/avp-petstore-demo/"+process.env.ENV+"/ApiKey", "/avp-petstore-demo/"+process.env.ENV+"/ApiRootUrl"],
      })
      .promise();

    console.log(params);
    for (const p of params.Parameters) {
      if (p.Name == "/avp-petstore-demo/"+process.env.ENV+"/ApiKey") {
        apiKey = p.Value;
      }
      if (p.Name == "/avp-petstore-demo/"+process.env.ENV+"/ApiRootUrl") {
        apiRootUrl = p.Value;
      }
    }

    var store = await getStore(event.pathParameters.storeId);
    if (store) {
      entities.entityList.push(store);
    }

    for (const storeId of stores) {
      if (storeId && storeId != "") {
        var store = await getStore(storeId);
        if (store) {
          entities.entityList.push(store);
          userEntity.attributes.employmentStoreCodes.set.push({
            entityIdentifier: {
              entityType: "MyApplication::Store",
              entityId: storeId,
            },
          });
        }
      }
    }
    for (const franchiseId of franchises) {
      if (franchiseId && franchiseId != "") {
        var franchise = await getFranchise(franchiseId);
        if (franchise) {
          userEntity.attributes.employmentStoreFranchiseCodes.set.push({
            entityIdentifier: {
              entityType: "MyApplication::StoreFranchise",
              entityId: franchiseId,
            },
          });
          entities.entityList.push(franchise);
        }
      }
    }
    groups.forEach((group) => {
      entities.entityList.push({
        identifier: {
          entityType: "MyApplication::Group",
          entityId: group,
        },
      });
      userEntity.parents.push({
        entityType: "MyApplication::Group",
        entityId: group,
      });
    });
    entities.entityList.push(userEntity);
  } catch (err) {
    console.log(err);
    return buildResponse(
      403,
      "Error while verifying token: " + err,
      event.methodArn,
      "Anonymous"
    );
  }

  //---------Prepare authorization query
  try {
    addResourceEntities(
      entities,
      actionMap[
        event.requestContext.httpMethod + event.requestContext.resourcePath
      ],
      event.pathParameters
    );
    console.log("EVENT  " + JSON.stringify(event));

    let authQuery = {
      policyStoreId,
      principal: {
        entityType: "MyApplication::User",
        entityId: payload["cognito:username"],
      },
      action: {
        actionType: "MyApplication::Action",
        actionId:
          actionMap[
            event.requestContext.httpMethod + event.requestContext.resourcePath
          ],
      },
      resource: buildResource(
        actionMap[
          event.requestContext.httpMethod + event.requestContext.resourcePath
        ],
        event.pathParameters
      ),
      entities,
    };

    console.log("AUTH QUERY" + JSON.stringify(authQuery));

    const authResult = await avp.isAuthorized(authQuery).promise();
    console.log("AUTH RESULT" + JSON.stringify(authResult));

    if (authResult.decision == "ALLOW") {
      //action is allowed by AVP
      return buildResponse(
        200,
        "Successful backend response for " +
          event.httpMethod +
          " " +
          event.path,
        authResult,
        event.methodArn,
        payload["cognito:username"]
      );
    } else {
      //action is denied by AVP
      return buildResponse(
        403,
        "You are not authorized to perform this action. " +
          event.httpMethod +
          " " +
          event.path,
        authResult,
        event.methodArn,
        payload["cognito:username"]
      );
    }
  } catch (err) {
    console.log(JSON.stringify(err));
    return buildResponse(
      403,
      "Error while running authorization query: " + err,
      {},
      event.methodArn,
      payload["cognito:username"]
    );
  }
};

function addResourceEntities(entities, action, pathParams) {
  if (["UpdatePet", "DeletePet"].contains(action)) {
    //pet related action
    entities.entityList.push({
      identifier: {
        entityType: "MyApplication::Pet",
        entityId: pathParams.petId,
      },
      attributes: {
        store: {
          entityIdentifier: {
            entityType: "MyApplication::Store",
            entityId: pathParams.storeId,
          },
        },
      },
    });
  } else if (["GetOrder", "CancelOrder"].contains(action)) {
    //order related action
    entities.entityList.push({
      identifier: {
        entityType: "MyApplication::Order",
        entityId: pathParams.orderNumber,
      },
      attributes: {
        store: {
          entityIdentifier: {
            entityType: "MyApplication::Store",
            entityId: pathParams.storeId,
          },
        },
        owner: {
          // Hardcoding the owner to abhi , this is for demonestration purposes
          entityIdentifier: {
            entityType: "MyApplication::User",
            entityId: "abhi",
          },
        },
      },
    });
  } //application related action
  else
    entities.entityList.push({
      identifier: {
        entityType: "MyApplication::Application",
        entityId: "PetStore",
      },
      attributes: {
        store: {
          entityIdentifier: {
            entityType: "MyApplication::Store",
            entityId: pathParams.storeId,
          },
        },
      },
    });
}
//---------helper function to get resource mapping for an action
function buildResource(action, pathParams) {
  if (["UpdatePet", "DeletePet"].contains(action)) {
    //pet related action
    return {
      entityType: "MyApplication::Pet",
      entityId: pathParams.petId,
    };
  } else if (["GetOrder", "CancelOrder"].contains(action)) {
    //order related action
    return {
      entityType: "MyApplication::Order",
      entityId: pathParams.orderNumber,
    };
  } else if (["ListOrders"].contains(action)) {
    //order related action
    return {
      entityType: "MyApplication::Store",
      entityId: pathParams.storeId,
    };
  } //application related action
  else
    return { entityType: "MyApplication::Application", entityId: "PetStore" };
}

//---------helper function to build HTTP response
function buildResponse(code, message, authResult, resourceArn, principal) {
  var response = {
    principalId: principal,
    policyDocument: {
      Version: "2012-10-17",
      Statement: [
        {
          Action: "execute-api:Invoke",
          Effect: authResult?.decision || "DENY",
          Resource: resourceArn,
        },
      ],
    },
    context: {
      body: JSON.stringify(authResult),
    },
  };

  return response;
}

Array.prototype.contains = function (element) {
  return this.indexOf(element) > -1;
};

async function getFranchise(id) {
  if (!id || id == "") {
    return null;
  }
  try {
    const res = await superagent
      .get(apiRootUrl + "/" + apiFranchisePath + "/" + id)
      .set("x-api-key", apiKey);
    return transformToFranchise(res.body[0]);
  } catch (err) {
    console.error(err);
  }
}

async function getStore(id) {
  if (!id || id == "") {
    return null;
  }
  try {
    const res = await superagent
      .get(apiRootUrl + "/" + apiStorePath + "/" + id)
      .set("x-api-key", apiKey);
    return transformToStore(res.body[0]);
  } catch (err) {
    console.error(err);
  }
}

function transformToStore(body) {
  if (!body) {
    return null;
  }
  var store = {};
  store["identifier"] = {};
  store["identifier"]["entityType"] = "MyApplication::Store";
  store["identifier"]["entityId"] = body.id;
  if (body.franchise) {
    store["parents"] = [];
    store["parents"][0] = {};
    store["parents"][0]["entityType"] = "MyApplication::StoreFranchise";
    store["parents"][0]["entityId"] = body.franchise.id;
  }
  return store;
}

function transformToFranchise(body) {
  if (!body) {
    return null;
  }
  var franchise = {};
  franchise["identifier"] = {};
  franchise["identifier"]["entityType"] = "MyApplication::StoreFranchise";
  franchise["identifier"]["entityId"] = body.id;
  franchise["attributes"] = {};
  franchise["attributes"]["stores"] = {};
  franchise["attributes"]["stores"]["set"] = [];

  for (const storeId of body.stores) {
    var store = {};
    store["entityIdentifier"] = {};
    store["entityIdentifier"]["entityType"] = "MyApplication::Store";
    store["entityIdentifier"]["entityId"] = storeId.id;
    franchise["attributes"]["stores"]["set"].push(store);
  }

  return franchise;
}

//---------Map http method and resource path to an action defined in AuthZ model
const actionMap = {
  "GET/store/{storeId}/pets": "SearchPets",
  "POST/store/{storeId}/pet/create": "AddPet",
  "POST/store/{storeId}/order/create": "PlaceOrder",
  "POST/store/{storeId}/pet/update/{petId}": "UpdatePet",
  "GET/store/{storeId}/order/get/{orderNumber}": "GetOrder",
  "POST/store/{storeId}/order/cancel/{orderNumber}": "CancelOrder",
  "GET/store/{storeId}/orders": "ListOrders",
  "GET/store/{storeId}/inventory": "GetStoreInventory",
};

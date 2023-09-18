// This file is used to override the REST API resources configuration
import { AmplifyApiRestResourceStackTemplate } from '@aws-amplify/cli-extensibility-helper';

const customAuthorizerFunctionName = "petstoreAuthorizer";

export function override(resources: AmplifyApiRestResourceStackTemplate) {
    const { paths } = resources.restApi.body;
    Object.keys(paths).forEach((path) => {
        if (path.includes('{proxy+}')) {
            delete paths[path];
        }
    });

    const customAuthorizerFunctionArn = {
        "Fn::Join": [
            "",
            [
                "arn:aws:lambda:",
                {
                    Ref: "AWS::Region",
                },
                ":",
                {
                    Ref: "AWS::AccountId",
                },
                `:function:${customAuthorizerFunctionName}-`,
                {
                    Ref: "env",
                },
            ],
        ],
    };

    resources.addCfnResource(
        {
            type: "AWS::Lambda::Permission",
            properties: {
                FunctionName: customAuthorizerFunctionArn,
                Action: "lambda:InvokeFunction",
                Principal: "apigateway.amazonaws.com",
                SourceAccount: {
                    Ref: "AWS::AccountId",
                },
                SourceArn: {
                    "Fn::Join": [
                        "",
                        [
                            "arn:aws:execute-api:",
                            {
                                Ref: "AWS::Region",
                            },
                            ":",
                            {
                                Ref: "AWS::AccountId",
                            },
                            `:${resources.restApi.ref}/authorizers/*`,
                        ],
                    ],
                },
            },
        },
        "ApiGatewayPermission"
    );

    resources.restApi.body.securityDefinitions["api_key"] =  { 
            type: "apiKey",
            name: "x-api-key",
            in: "header"
        };

    resources.restApi.addPropertyOverride("Body.securityDefinitions", {
        LambdaAuthorizer: {
            type: "apiKey",
            name: "Authorization",
            in: "header",
            "x-amazon-apigateway-authtype": "custom",
            "x-amazon-apigateway-authorizer": {
                type: "request",
                authorizerUri: {
                    "Fn::Join": [
                        "",
                        [
                            "arn:aws:apigateway:",
                            {
                                Ref: "AWS::Region",
                            },
                            ":lambda:path/2015-03-31/functions/",
                            customAuthorizerFunctionArn,
                            "/invocations",
                        ],
                    ],
                },
                authorizerResultTtlInSeconds: 60,
                identitySource: "method.request.header.Authorization, context.path"
            }
        }
    });

    // for each path in the rest API, add the authorizer for all methods
    for (const path in resources.restApi.body.paths) {
        if (path.startsWith("/admin")) {
            resources.restApi.addPropertyOverride(
                `Body.paths.${path}.x-amazon-apigateway-any-method.parameters`,
                [
                    ...resources.restApi.body.paths[path]["x-amazon-apigateway-any-method"]
                        .parameters,
                    {
                        name: "x-api-key",
                        in: "header",
                        required: true,
                        type: "string",
                    },
                ]
            );
            resources.restApi.addPropertyOverride(
                `Body.paths.${path}.x-amazon-apigateway-any-method.security`,
                [{ api_key: [] }]
            );
            continue;
        }
        // add the Authorization header as a parameter to the rest API for the path
        resources.restApi.addPropertyOverride(
            `Body.paths.${path}.x-amazon-apigateway-any-method.parameters`,
            [
                ...resources.restApi.body.paths[path]["x-amazon-apigateway-any-method"]
                    .parameters,
                {
                    name: "Authorization",
                    in: "header",
                    required: false,
                    type: "string",
                },
            ]
        );
        resources.restApi.addPropertyOverride(
            `Body.paths.${path}.x-amazon-apigateway-any-method.security`,
            [{ LambdaAuthorizer: [] }]
        );
    }
}

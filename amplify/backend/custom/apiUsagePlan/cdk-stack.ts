import * as cdk from 'aws-cdk-lib';
import * as AmplifyHelpers from '@aws-amplify/cli-extensibility-helper';
import { AmplifyDependentResourcesAttributes } from '../../types/amplify-dependent-resources-ref';
import { Construct } from 'constructs';
import { ApiKey, UsagePlan } from 'aws-cdk-lib/aws-apigateway';
import { v4 as uuidv4 } from 'uuid';

export class cdkStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps, amplifyResourceProps?: AmplifyHelpers.AmplifyResourceProps) {
    super(scope, id, props);
    /* Do not remove - Amplify CLI automatically injects the current deployment environment in this input parameter */
    new cdk.CfnParameter(this, 'env', {
      type: 'String',
      description: 'Current Amplify CLI env name',
    });

    const dependencies: AmplifyDependentResourcesAttributes = AmplifyHelpers.addResourceDependency(this,
      amplifyResourceProps.category,
      amplifyResourceProps.resourceName,
      [
        { category: "api", resourceName: "petstoreapi" }
      ]
    );

    const apigw = cdk.aws_apigateway.RestApi.fromRestApiId(this, 'PetstoreAPI', dependencies.api.petstoreapi.ApiId);
    const apiKeyValue = uuidv4();

    //Create API Key
    const apiKey = new ApiKey(this, "petstoreDemoAPIKey", {
      value: apiKeyValue,
      enabled: true
    });
    
    //Create Usage Plan
    const usagePlan = new UsagePlan(this, "usagePlanPetStore", {
      name: "usagePlanPetStore",
      description: "Demo Usage Plan for Petstore",
      throttle: {
        rateLimit: 200,
        burstLimit: 100
      },
      quota: {
        limit: 1000,
        period: cdk.aws_apigateway.Period.DAY
      }
    });
    usagePlan.addApiKey(apiKey);

    new cdk.aws_ssm.StringParameter(this, 'ApiKey', {
      parameterName: "/avp-petstore-demo/"+AmplifyHelpers.getProjectInfo().envName+"/ApiKey",
      description: "API Key for Petstore Demo",
      stringValue: apiKeyValue
    });
    new cdk.aws_ssm.StringParameter(this, 'ApiRootUrl', {
      parameterName: "/avp-petstore-demo/"+AmplifyHelpers.getProjectInfo().envName+"/ApiRootUrl",
      description: "API Root URL",
      stringValue: `https://${cdk.Fn.ref(dependencies.api.petstoreapi.ApiId)}.execute-api.${this.region}.amazonaws.com/${cdk.Fn.ref('env')}`
    });

  }
  
}
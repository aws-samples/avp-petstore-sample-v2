import * as cdk from 'aws-cdk-lib';
import * as AmplifyHelpers from '@aws-amplify/cli-extensibility-helper';
import { AmplifyDependentResourcesAttributes } from '../../types/amplify-dependent-resources-ref';
import { Construct } from 'constructs';
import * as verifiedpermissions from 'aws-cdk-lib/aws-verifiedpermissions';
import policyStoreSchema from './assets/policySchema.json';
import policySamples from './assets/policySamples.json';


export class cdkStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps, amplifyResourceProps?: AmplifyHelpers.AmplifyResourceProps) {
    super(scope, id, props);
    /* Do not remove - Amplify CLI automatically injects the current deployment environment in this input parameter */
    new cdk.CfnParameter(this, 'env', {
      type: 'String',
      description: 'Current Amplify CLI env name',
    });

    const cfnPolicyStore = new verifiedpermissions.CfnPolicyStore(this, 'PetstorePolicyStore', {
      validationSettings: {
        mode: 'STRICT',
      },
      schema: {
        cedarJson: JSON.stringify(policyStoreSchema)
      }
    }
    );

    const customerAVPPolicy1 = new verifiedpermissions.CfnPolicy(this, 'PetstoreCustomerAVPPolicy1', {
      policyStoreId: cfnPolicyStore.attrPolicyStoreId,
      definition: {
        static: {
          statement: policySamples.CustomerPolicy1,
          description: "Customer - This policy allows customers to search for pets and place orders RBAC"
        }
      }
    });

    const customerAVPPolicy2 = new verifiedpermissions.CfnPolicy(this, 'PetstoreCustomerAVPPolicy2', {
      policyStoreId: cfnPolicyStore.attrPolicyStoreId,
      definition: {
        static: {
          statement: policySamples.CustomerPolicy2,
          description: "Customer - Get Order, this policy allows customers to get details of their orders"
        }
      }
    });

    const franchiseAVPPolicy1 = new verifiedpermissions.CfnPolicy(this, 'PetstoreFranchiseAVPPolicy1', {
      policyStoreId: cfnPolicyStore.attrPolicyStoreId,
      definition: {
        static: {
          statement: policySamples.FranchiseOwnerPolicy1,
          description: "Franchise owner can list all orders under its brand"
        }
      }
    });

    const franchiseAVPPolicy2 = new verifiedpermissions.CfnPolicy(this, 'PetstoreFranchiseAVPPolicy2', {
      policyStoreId: cfnPolicyStore.attrPolicyStoreId,
      definition: {
        static: {
          statement: policySamples.FranchiseOwnerPolicy2,
          description: "Franchise owner can view all orders under its brand"
        }
      }
    });

    const storeAVPPolicy1 = new verifiedpermissions.CfnPolicy(this, 'PetstoreStoreAVPPolicy1', {
      policyStoreId: cfnPolicyStore.attrPolicyStoreId,
      definition: {
        static: {
          statement: policySamples.StoreOwnerPolicy1,
          description: "Store Owner WITH store check, this is a RBAC policy that allow store owners to get inventory and list of orders"
        }
      }
    });

    const storeAVPPolicy2 = new verifiedpermissions.CfnPolicy(this, 'PetstoreStoreAVPPolicy2', {
      policyStoreId: cfnPolicyStore.attrPolicyStoreId,
      definition: {
        static: {
          statement: policySamples.StoreOwnerPolicy2,
          description: "Store owner can get all orders for stores they own"
        }
      }
    });
    new cdk.CfnOutput(this, 'PetstorePolicyStoreId', {
      value: cfnPolicyStore.attrPolicyStoreId
    });
  }
}
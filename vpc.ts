import { Construct } from "constructs";
import {
  Vpc as VpcModule,
  VpcOptions,
} from "./.gen/modules/terraform-aws-modules/vpc/aws";

const defaultOptions: VpcOptions = {
  cidr: "10.0.0.0/16",
  azs: ["eu-west-1a", "eu-west-1b", "eu-west-1c"],
  privateSubnets: ["10.0.1.0/24", "10.0.2.0/24", "10.0.3.0/24"],
  publicSubnets: ["10.0.101.0/24", "10.0.102.0/24", "10.0.103.0/24"],
  enableNatGateway: true,
};

export class Vpc extends VpcModule {
  public constructor(scope: Construct, name: string, options: VpcOptions) {
    super(scope, name, { ...options, ...defaultOptions });
  }

  public get privateSubnetIdsOutput(): string[] {
    const subnets: any = super.privateSubnetsOutput;
    return <string[]>subnets;
  }

  public get publicSubnetIdsOutput(): string[] {
    const subnets: any = super.publicSubnetsOutput;
    return <string[]>subnets;
  }
}

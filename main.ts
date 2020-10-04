import { Construct } from "constructs";
import { App, TerraformStack } from "cdktf";
import fs from "fs";
import {
  AwsProvider,
  EcsCluster,
  DataAwsIamPolicyDocument,
  IamRole,
  IamRolePolicyAttachment,
  EcsTaskDefinition,
  SecurityGroup,
  EcsService,
  Alb,
  AlbTargetGroup,
  AlbListener,
  CloudwatchLogGroup,
} from "./.gen/providers/aws";
import { Vpc } from "./vpc";
import config from "./config.json";

class BlogStack extends TerraformStack {
  constructor(scope: Construct, name: string) {
    super(scope, name);

    new AwsProvider(this, "aws", {
      region: config.aws_region,
    });

    const logGroup = new CloudwatchLogGroup(this, "log", {
      namePrefix: name,
    });

    const vpc = new Vpc(this, "vpc", {
      name: name,
    });

    const ecsCluster = new EcsCluster(this, "cluster", {
      name: name,
    });

    const policy = new DataAwsIamPolicyDocument(this, "policy", {
      statement: [
        {
          actions: ["sts:AssumeRole"],
          principals: [
            {
              type: "Service",
              identifiers: ["ecs-tasks.amazonaws.com"],
            },
          ],
        },
      ],
    });

    const taskRole = new IamRole(this, "executionRole", {
      name: `${name}-ecs-execution-role`,
      assumeRolePolicy: policy.json,
    });

    new IamRolePolicyAttachment(this, "executionRoleAttachment", {
      role: taskRole.name || "",
      policyArn:
        "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy",
    });

    const containerDef = [
      {
        essential: true,
        image: "npalm/040code.github.io:latest",
        name: "blog",
        portMappings: [
          {
            hostPort: 80,
            protocol: "tcp",
            containerPort: 80,
          },
        ],
        logConfiguration: {
          logDriver: "awslogs",
          options: {
            "awslogs-group": logGroup.name,
            "awslogs-region": config.aws_region,
            "awslogs-stream-prefix": "040code",
          },
        },
      },
    ];

    const taskDefinition = new EcsTaskDefinition(this, "taskDefinition", {
      family: "test",
      cpu: "256",
      memory: "512",
      containerDefinitions: JSON.stringify(containerDef),
      networkMode: "awsvpc",
      requiresCompatibilities: ["FARGATE"],
      executionRoleArn: taskRole.arn,
    });

    // see https://github.com/hashicorp/terraform-cdk/issues/234
    const sgDefaults = {
      description: "",
      selfAttribute: false,
      ipv6CidrBlocks: [],
      prefixListIds: [],
      securityGroups: [],
    };

    const sgAlb = new SecurityGroup(this, "sgAlb", {
      namePrefix: `${name}-alb`,
      vpcId: vpc.vpcIdOutput,
      ingress: [
        {
          ...sgDefaults,
          protocol: "tcp",
          fromPort: 80,
          toPort: 80,
          cidrBlocks: ["0.0.0.0/0"],
        },
      ],
      egress: [
        {
          ...sgDefaults,
          protocol: "tcp",
          fromPort: 0,
          toPort: 65535,
          cidrBlocks: [vpc.vpcCidrBlockOutput || ""],
        },
      ],
    });

    const sgService = new SecurityGroup(this, "sgService", {
      name: "blog-service",
      vpcId: vpc.vpcIdOutput,
      ingress: [
        {
          ...sgDefaults,
          protocol: "tcp",
          fromPort: 0,
          toPort: 65535,
          cidrBlocks: [vpc.vpcCidrBlockOutput || ""],
        },
      ],
      egress: [
        {
          ...sgDefaults,
          protocol: "tcp",
          fromPort: 0,
          toPort: 65535,
          cidrBlocks: ["0.0.0.0/0"],
        },
      ],
    });

    const alb = new Alb(this, "alb", {
      internal: false,
      subnets: vpc.publicSubnetIdsOutput,
      securityGroups: [sgAlb.id || ""],
    });

    const target = new AlbTargetGroup(this, "target", {
      port: 80,
      protocol: "HTTP",
      vpcId: vpc.vpcIdOutput,
      targetType: "ip",
    });

    const listener = new AlbListener(this, "listener", {
      port: 80,
      loadBalancerArn: alb.arn,
      defaultAction: [
        {
          targetGroupArn: target.arn,
          type: "forward",
        },
      ],
    });

    new EcsService(this, "service", {
      name: "blog",
      cluster: ecsCluster.id,
      taskDefinition: taskDefinition.arn,
      desiredCount: 1,
      launchType: "FARGATE",

      loadBalancer: [
        {
          targetGroupArn: target.arn,
          containerName: "blog",
          containerPort: 80,
        },
      ],

      networkConfiguration: [
        {
          securityGroups: [sgService.id || ""],
          subnets: vpc.privateSubnetIdsOutput,
          assignPublicIp: false,
        },
      ],

      dependsOn: [listener],
    });
  }
}

class BlogApp extends App {
  synth(): void {
    super.synth();
    const tfOutputFile = this.outdir + "/cdk.tf.json";
    fs.readFile(tfOutputFile, "utf8", (err, data) => {
      if (err) throw err;
      const stringData = data
        .toString()
        .replace(new RegExp("self_attribute", "g"), "self");
      fs.writeFile(tfOutputFile, stringData, (err) => {
        if (err) console.log(err);
        console.log(
          `Patched ${tfOutputFile} for bug https://github.com/hashicorp/terraform-cdk/issues/282`
        );
      });
    });
  }
}

const app = new BlogApp({
  stackTraces: false,
});
new BlogStack(app, config.environment);
app.synth();

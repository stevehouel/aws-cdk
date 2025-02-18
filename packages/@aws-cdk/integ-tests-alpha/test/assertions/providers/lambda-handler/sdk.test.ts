// Copyright 2021 Amazon.com, Inc. or its affiliates. All Rights Reserved.
import { S3Client, ListObjectsOutput, ListObjectsCommand } from '@aws-sdk/client-s3';
import { DescribeInstancesCommand, EC2Client } from '@aws-sdk/client-ec2';
import { mockClient } from 'aws-sdk-client-mock';
import { AwsApiCallRequest, AwsApiCallResult } from '../../../../lib/assertions';
import { AwsApiCallHandler } from '../../../../lib/assertions/providers/lambda-handler/sdk';
import 'aws-sdk-client-mock-jest';

function sdkHandler() {
  const context: any = {
    getRemainingTimeInMillis: () => 50000,
  };
  return new AwsApiCallHandler({} as any, context); // as any to ignore all type checks
}
beforeAll(() => {
  jest.useFakeTimers();
  jest.spyOn(console, 'log').mockImplementation(() => { return true; });
});
afterAll(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

let s3Mock = mockClient(S3Client);
let ec2Mock = mockClient(EC2Client);
describe('SdkHandler', () => {
  beforeEach(() => {
    s3Mock.reset();
    ec2Mock.reset();
  });

  test('default', async () => {
    // GIVEN
    const expectedResponse = {
      Contents: [
        {
          Key: 'first-key',
          ETag: 'first-key-etag',
        },
        {
          Key: 'second-key',
          ETag: 'second-key-etag',
        },
      ],
    } as ListObjectsOutput;
    s3Mock.on(ListObjectsCommand).resolves(expectedResponse);
    const handler = sdkHandler() as any;
    const request: AwsApiCallRequest = {
      service: 'S3',
      api: 'listObjects',
      parameters: {
        Bucket: 'myBucket',
      },
    };

    // WHEN
    const response: AwsApiCallResult = await handler.processEvent(request);

    // THEN
    expect(response.apiCallResponse).toEqual(expectedResponse);
  });

  describe('decode', () => {
    test('boolean true', async () => {
      // GIVEN
      ec2Mock.on(DescribeInstancesCommand).resolves({});

      const handler = sdkHandler() as any;
      const request: AwsApiCallRequest = {
        service: 'EC2',
        api: 'describeInstances',
        parameters: {
          DryRun: 'TRUE:BOOLEAN',
        },
      };

      // WHEN
      await handler.processEvent(request);

      // THEN
      expect(ec2Mock).toHaveReceivedCommandWith(DescribeInstancesCommand, { DryRun: true });
    });

    test('boolean false', async () => {
      // GIVEN
      ec2Mock.on(DescribeInstancesCommand).resolves({});
      const handler = sdkHandler() as any;
      const request: AwsApiCallRequest = {
        service: 'EC2',
        api: 'describeInstances',
        parameters: {
          DryRun: 'FALSE:BOOLEAN',
        },
      };

      // WHEN
      await handler.processEvent(request);

      // THEN
      expect(ec2Mock).toHaveReceivedCommandWith(DescribeInstancesCommand, { DryRun: false });
    });
  });

  test('restrict output path', async () => {
    // GIVEN
    const responseFake = {
      Name: 'bucket-name',
      Contents: [
        {
          Key: 'first-key',
          ETag: 'first-key-etag',
        },
        {
          Key: 'second-key',
          ETag: 'second-key-etag',
        },
      ],
    } as ListObjectsOutput;
    s3Mock.on(ListObjectsCommand).resolves(responseFake);
    const handler = sdkHandler() as any;
    const request: AwsApiCallRequest = {
      service: 'S3',
      api: 'listObjects',
      parameters: {
        Bucket: 'myBucket',
      },
      outputPaths: ['Name', 'Contents.0.Key'],
    };

    // WHEN
    const response: AwsApiCallResult = await handler.processEvent(request);

    // THEN
    expect(response).toEqual({
      'apiCallResponse.Name': 'bucket-name',
      'apiCallResponse.Contents.0.Key': 'first-key',
    });
  });
});

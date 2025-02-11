# Video Transform
## About
Video Transform is a scalable cloud application hosted on AWS that aims to serve the purpose of transcoding videos from MP4 format to MOV format. The task of video transcoding into various video formats is a useful but computationally intensive one. However, when this service is performed on a grand scale, load distribution and concurrency become much more complicated to design for. Users of this application can select a video in single MP4 format and upload it. The next screen will redirect to a download page which will allow them to download the transcoded MOV video. This application uses persistence services such as S3 and SQS FIFO queue to facilitate connection and data transfer between frontend and backend to fulfil the task of encoding videos. This design choice allows both the frontend and backend to take advantage of ‘scaling out’. On the backend, if there are too many requests to encode videos then it can scale outwards, by distributing tasks to other worker VMs, to maintain the load.

Node.js is used for the backend and routing for the application, and Handlebars was used to create HTML templates that allow for dynamic and iterative loading of content. The chosen persistence services for this application are Amazon S3 (Simple Storage Service) and SQS FIFO (Simple Queueing Service, First-In-First-Out). S3 allows for simple object stores called ‘Buckets’ to store JSON objects and files. This is desired as we are only uploading the downloading singular video files at a time. SQS allows for sending and receiving of messages between software components without losing messages or requiring other services to be available. In this application, this allows for video encoding jobs to be continuously enqueued, even while the backend is already processing jobs, and ensures that the order of the jobs is maintained. It also allows for the backend, that does the video processing, to inform the corresponding frontend responsible for sending that job that it has been completed. The chosen services to support scaling for this application are Amazon EC2 and Amazon ASG (Auto Scaling Group). EC2 is a cloud computing platform that allows users to deploy applications to a secure and scalable environment. ASG is a collection of EC2 instances that acts as a logical unit for scaling and management purposes, that for example scales out in response to demand.

## Libraries and AWS Services
One NodeJS library is used in this application for video transcoding:
* Fluent FFmpeg-API: https://www.npmjs.com/package/fluent-ffmpeg

AWS Services used:
* Amazon S3: https://aws.amazon.com/s3/
* Amazon SQS FIFO: https://docs.aws.amazon.com/AWSSimpleQueueService/latest/SQSDeveloperGuide/sqs-fifo-queues.html
* Amazon EC2: https://aws.amazon.com/ec2/
* Amazon ASG: https://docs.aws.amazon.com/autoscaling/ec2/userguide/auto-scalinggroups.html

*NOTE*: API keys are expired and so are the AWS instances used here.

## How to run
* Run 'npm install'
* Run 'npm start'
* Access via localhost port 3000

## Demo Videos
### Multiple Windows
https://github.com/user-attachments/assets/0f025b8d-ae27-4bf3-b4e1-5cfd778d40a6

### Single Window
https://github.com/user-attachments/assets/fdbfab97-8836-4847-9dc9-18906ab2827c

### Load Balancing
#### CPU Usage with number of instances
![VideoTransform-LoadBalancing](https://github.com/user-attachments/assets/433686fe-401c-4b64-aa35-20fbaba9876b)

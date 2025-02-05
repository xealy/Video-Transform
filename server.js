const express = require("express");
const multer = require("multer");
const fluentFfmpeg = require("fluent-ffmpeg");
const AWS = require('aws-sdk');
const fs = require('fs');
require('dotenv').config();
require('events').EventEmitter.defaultMaxListeners = 20; // new

// AWS Auto-fill Credentials
AWS.config.update({
    accessKeyId: process.env.aws_access_key_id,
    secretAccessKey: process.env.aws_secret_access_key,
    sessionToken: process.env.aws_session_token,
    region: "ap-southeast-2",
});

// AWS Config File
// AWS.config.update({
//     accessKeyId: AWS.config.credentials.accessKeyId,
//     secretAccessKey: AWS.config.credentials.secretAccessKey,
//     sessionToken: AWS.config.credentials.sessionToken,
//     region: "ap-southeast-2",
// });

// S3 setup
// ALEX'S S3
// const bucketName = "video-transform-bucket";
// const s3 = new AWS.S3({ apiVersion: "2006-03-01" });
// TIU'S S3
const bucketName = "nguyen-duong-cab423-assignment1";
const s3 = new AWS.S3({ apiVersion: "2006-03-01" });

// Create Bucket
s3.createBucket({ Bucket: bucketName })
    .promise()
    .then(() => console.log(`Created bucket: ${bucketName}`))
    .catch((err) => {
        // We will ignore 409 errors which indicate that the bucket already exists
        if (err.statusCode !== 409) {
            console.log(`Error creating bucket: ${err}`);
        }
    }
);

// SQS setup
// ALEX'S SQS
// const sqs = new AWS.SQS({ apiVersion: '2012-11-05' });
// const sqsURL = 'https://sqs.ap-southeast-2.amazonaws.com/901444280953/video-transform-queue.fifo';
// TIU'S SQS
const sqs = new AWS.SQS();
const sqsURL = 'https://sqs.ap-southeast-2.amazonaws.com/901444280953/NguyenDuongCAB432-GroupProject.fifo';

// SQS 
const params = {
    QueueUrl: sqsURL, // URL of SQS queue
    MaxNumberOfMessages: 1, // Number of messages to receive per request
    WaitTimeSeconds: 20, // Long polling (adjust as needed)
    VisibilityTimeout: 10 // PREVIOUSLY 10
};

// >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>> <<<<<<<<<<<<<<<<<<<<<<<<<<<<<< //

const app = express();

const port = 3001;

// Set up Multer for file uploads
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, "uploads/"); // Uploads will be stored in the 'uploads' directory
    },
    filename: function (req, file, cb) {
        cb(null, file.originalname);
    },
});

// const upload = multer({ storage: storage });

// Serve static files
app.use(express.static("public"));

// Serve uploaded images as static files
app.use('/uploads', express.static('uploads'));

pollQueue();
// Polling Queue continuously
async function pollQueue() {
    try {
        const data = await sqs.receiveMessage(params).promise();

        if (data.Messages) {
            // Process the received messages here
            for (const message of data.Messages) {
                const messageBody = message.Body;
                console.log('Received message:', messageBody);

                // Check if the message has a 'video' keyword
                if (messageBody.includes('video')) {

                    // DELETE MESSAGE FIRST after saving message body (given message contains 'video' keyword)
                    await sqs.deleteMessage({
                        QueueUrl: params.QueueUrl,
                        ReceiptHandle: message.ReceiptHandle,
                    }).promise();

                    try {
                        const GetS3Video = {
                            Bucket: bucketName,
                            Key: messageBody,
                        };

                        const Viddata = await s3.getObject(GetS3Video).promise();
                        console.log('We downloaded the original video from S3');
                        
                        const fileName = messageBody.split('/').pop(); // Extract the file name from the path
                        const theFile = fileName.split('-').pop();

                        const localFilePath = `/uploads/${theFile}`;
                        const localFilePath1 = '.' + localFilePath;


                        await new Promise((resolve, reject) => {
                            fs.writeFile(localFilePath1, Viddata.Body, (err) => {
                                if (err) {
                                    console.error('Error writing the file:', err);
                                    reject(err);
                                } else {
                                    resolve();
                                    console.log(`File written to ${localFilePath}`);
                                }
                            })
                        });


                        const outputFileName = `encoded-${theFile.split(".")[0]}.mov`;
                        const outputPath = `uploads/${outputFileName}`;

                        await new Promise((resolve, reject) => {
                            fluentFfmpeg()
                                .input(localFilePath1)
                                .output(outputPath)
                                .on("end", async () => {
                                    // Upload to S3
                                    const objectParams = {
                                        Bucket: `${bucketName}`,
                                        Key: outputFileName,
                                        Body: require('fs').readFileSync(outputPath),
                                    };
                                    await s3.putObject(objectParams)
                                        .promise()
                                        .then(() => {
                                            console.log(`File ${params.Key} has been converted to ${outputFileName}`);
                                            console.log(`Successfully uploaded data to ${bucketName}/${outputFileName}`);

                                            const send_message_params = {
                                                QueueUrl: sqsURL,
                                                MessageBody: `${outputFileName}`,
                                                MessageDeduplicationId: outputFileName,
                                                MessageGroupId: "Done"
                                            };
    
                                            sqs.sendMessage(send_message_params, (err, send_data) => {
                                                if (err) {
                                                    console.log('Error:', err);
                                                    reject(err);
                                                } else {
                                                    console.log(outputFileName);
                                                    resolve();
                                                }
                                            });

                                        })
                                        .catch((err) => {
                                            console.error(`Error uploading ${outputFileName} to S3: ${err}`);
                                            reject(err);
                                        });
                                })
                                .on("error", (err) => {
                                    console.error(`Error converting ${file.originalname} to MOV: ${err}`);
                                    reject(err);
                                })
                                .run();
                        });
                    } catch (err) {
                        console.log(err);
                    }
                } 
                else {
                    const params = {
                        QueueUrl: sqsURL,
                        ReceiptHandle: message.ReceiptHandle,
                        VisibilityTimeout: 20, // PREVIOUSLY 0, maybe this 10, to extend life of 'encoded-' message ??
                    };

                    // Change this
                    sqs.changeMessageVisibility(params, (err, data) => {
                        if (err) {
                            console.log('Error changing message visibility:', err);
                        } else {
                            console.log('Message visibility changed successfully.');
                        }
                    });
                }
            }
        }
    } catch (err) {
        console.error('Error receiving messages:', err);
    }

    // Continue polling
    setTimeout(pollQueue, 0); // This will ensure that the next poll is initiated asynchronously
}

app.listen(port, () => {
    console.log(`Server is running on port localhost:${port}`);
});
var express = require('express');
var router = express.Router();
const multer = require("multer");
const AWS = require('aws-sdk');
require('dotenv').config();
// new packages
require('events').EventEmitter.defaultMaxListeners = 20; 
const path = require('node:path'); 

// Multer
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
      cb(null, "uploads/"); // Uploads will be stored in the 'uploads' directory 
  },
  filename: function (req, file, cb) {
      cb(null, file.originalname);
  },
});
const upload = multer({ storage: storage });

// AWS Auto-fill Credentials
AWS.config.update({
  accessKeyId: process.env.aws_access_key_id,
  secretAccessKey: process.env.aws_secret_access_key,
  sessionToken: process.env.aws_session_token,
  region: "ap-southeast-2",
});

// AWS Config File
// AWS.config.update({
//   accessKeyId: AWS.config.credentials.accessKeyId,
//   secretAccessKey: AWS.config.credentials.secretAccessKey,
//   sessionToken: AWS.config.credentials.sessionToken,
//   region: "ap-southeast-2",
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
      if (err.statusCode !== 409) {
          console.log(`Error creating bucket: ${err}`);
      }
  }
);

// SQS setup
// ALEX'S SQS
// const queueUrl = 'https://sqs.ap-southeast-2.amazonaws.com/901444280953/video-transform-queue.fifo';
// const sqs = new AWS.SQS(); // Create an SQS instance
// TIU'S SQS
const sqs = new AWS.SQS();
const queueUrl = 'https://sqs.ap-southeast-2.amazonaws.com/901444280953/NguyenDuongCAB432-GroupProject.fifo';

router.post("/", upload.array("image", 10), async (req, res, next) => {
  var alertBool = false;

  async function processVideos() {
    for (file of req.files) {
      const s3Key = `video-${file.originalname}`;
      console.log(s3Key);

      // Create S3 check
      const first_params = { 
          Bucket: bucketName, 
          Key: s3Key
      };

      // Check S3 
      await s3.getObject(first_params)
      .promise()
      .then(async (result) => {
          console.log('S3 RESULT HERE');
          console.log(result);
          alertBool = true;
      })
      .catch(async (err) => { // EXPERIMENT: added async here
        if (err.statusCode === 404) {
          await enqueueFFmpegJob(file); // ENQUEUE HERE
        }
      });
    }

  }

  function enqueueFFmpegJob(file) {
    return new Promise(async (resolve, reject) => {
      const outputFileName = `video-${file.originalname}`;
      const outputPath = `uploads/${file.originalname}`;
      encodedFileName = `encoded-${file.originalname.split(".")[0]}.mov`;

      const objectParams = { Bucket: `${bucketName}`, Key: outputFileName, Body: require('fs').readFileSync(outputPath)};
          
      await s3.putObject(objectParams)
      .promise()
      .then(() => {
          console.log(`File ${file.originalname} has been converted to ${outputFileName}`);
          console.log(`Successfully uploaded data to ${bucketName}/${outputFileName}`);

          // SQS Message
          const params = {
            QueueUrl: queueUrl,
            MessageBody: outputFileName,
            MessageGroupId: "Encode", // Required for FIFO queues
            MessageDeduplicationId: outputFileName, // Required for FIFO queues
          };
      
          sqs.sendMessage(params, (err, data) => {
            if (err) {
              console.error('Error enqueuing FFmpeg job:', err);
              reject(err);
            } else {
              console.log('FFmpeg job enqueued:', data.MessageId);
              console.log('Enqueued file:', outputFileName);
              resolve();
            }
          });

      })
      .catch((err) => { //If not, then print out error
          console.error(`Error uploading ${outputFileName} to S3: ${err}`);
      });

    });
  }

  function pollQueue() {
    return new Promise(async (resolve, reject) => {
        try {
            const receiveMessages = async () => {
                const params = {
                    QueueUrl: queueUrl,
                    MaxNumberOfMessages: 1,
                    WaitTimeSeconds: 20,
                    VisibilityTimeout: 10,
                };
                const data = await sqs.receiveMessage(params).promise();

                if (data.Messages) {
                    for (const message of data.Messages) {
                        const messageBody = message.Body;
                        console.log('Received message:', messageBody);

                        if (messageBody.includes(encodedFileName)) {
                            try {
                                const GetS3Video = {
                                    Bucket: bucketName,
                                    Key: messageBody,
                                };

                                const result = await s3.getObject(GetS3Video).promise();
                                console.log('We downloaded the encoded video from S3');
                                console.log(result);

                                const urlExpiration = 3600;
                                signedUrl = s3.getSignedUrl('getObject', {
                                    Bucket: bucketName,
                                    Key: messageBody,
                                    Expires: urlExpiration,
                                });
                                console.log(signedUrl);

                                await sqs.deleteMessage({
                                    QueueUrl: params.QueueUrl,
                                    ReceiptHandle: message.ReceiptHandle,
                                }).promise();
                            } catch (err) {
                                console.log(err);
                            }
                        } else {
                            const visibilityParams = {
                                QueueUrl: queueUrl,
                                ReceiptHandle: message.ReceiptHandle,
                                VisibilityTimeout: 0,
                            };

                            sqs.changeMessageVisibility(visibilityParams, (err, data) => {
                                if (err) {
                                    console.log('Error changing message visibility:', err);
                                } else {
                                    console.log('Message visibility changed successfully.');
                                }
                            });

                            await receiveMessages();
                        }
                    }
                }
            };

            await receiveMessages();
            resolve(); // Resolve the outer promise once polling is complete
        } catch (err) {
            console.error('Error receiving messages:', err);
            reject(err); // Reject the outer promise in case of an error
        }
    });
  }


  // START OF PROCESSING
  // START OF Validation Conditionals
  if (!req.files || req.files.length === 0) {
    // return res.status(400).json({ message: "No files uploaded." });
    return res.redirect('/no_file_validation');
  }
  const isMP4 = (filePath) => {
    const extension = path.extname(filePath);
    return extension.toLowerCase() === '.mp4';
  };
  
  if (!isMP4(req.files[0].originalname)) {
    return res.redirect('/file_validation');
  }
  // END OF Validation Conditionals

  try {
    var signedUrl = "";
    var encodedFileName = "";
    await processVideos();

    if (alertBool) {
      return res.redirect('/s3_validation');
    } else {
      // await pollQueue();
      // Usage:
      await pollQueue()
      .then(() => {
          console.log('Polling complete.');
      })
      .catch((err) => {
          console.error('Error in pollQueue:', err);
      });
      console.log(signedUrl);
      return res.render('video_encode', { title: 'Video Encoding', output_link_path: signedUrl});
    }
  } catch(err) {
    console.log(err);
  }
});

router.get('/', async function(req, res, next) {
  res.render('video_encode', { title: 'Video Encoding', output_link_path: '/' });
});

module.exports = router;
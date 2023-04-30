const nodemailer = require("nodemailer")
const mailTransport = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: 'frozenmango747@gmail.com',
        pass: process.env.GMAIL_PASS
    }

});

async function sendEmail(mail){
    console.info(`Sending email to ${mail.to}.`)
    await new Promise((resolve, reject) => {
        // verify connection configuration
        mailTransport.verify(function (error, success) {
            if (error) {
                console.log(error);
                reject(error);
            } else {
                //console.log("Server is ready to take our messages");
                resolve(success);
            }
        });
    });
    await new Promise((resolve, reject) => {
        // send mail
        mailTransport.sendMail(mail, (err, info) => {
            if (err) {
                console.error(err);
                reject(err);
            } else {
                //console.log(info);
                resolve(info);
            }
        });
    });
}


async function sendVerificationEmail(to, token){
    const link = process.env.HOST + "/verify?id=" + token;
    const mail = {
        from: 'tango@frozenmango747.com',
        to,
        subject: 'Verify Your Email',
        html: `please click this link to <a href="${link}">verify your email.</a>`
    };
    sendEmail(mail)
}

async function sendPasswordResetEmail(to, token){
    const link = process.env.HOST + "/reset-password?id=" + token;
    const mail = {
        from: 'tango@frozenmango747.com',
        to,
        subject: 'Reset Your Password',
        html: `please click this link to <a href="${link}">reset your password.</a>`
    };
    sendEmail(mail)
}

module.exports = {
    sendVerificationEmail,
    sendPasswordResetEmail
}
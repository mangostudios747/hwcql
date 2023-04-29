const nodemailer = require("nodemailer")
const mailTransport = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: 'frozenmango747@gmail.com',
        pass: process.env.GMAIL_PASS
    }

});


async function sendVerificationEmail(to, token, host){
    console.info(`Sending email to ${to}.`)
    const link = "http://" + host + "/verify?id=" + token;
    const mail = {
        from: 'tango@frozenmango747.com',
        to,
        subject: 'test',
        html: `please click this link to <a href="${link}">verify your email.</a>`
    };
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

module.exports = {
    sendVerificationEmail
}
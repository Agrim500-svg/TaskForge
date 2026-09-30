import Mailgen from "mailgen";
import nodemailer from "nodemailer";

const sendEmail = async (options) => {
    const mailGenerator = new Mailgen({
        theme: "default",
        product: {
            name: "TaskForge",
            link: process.env.FRONTEND_BASE_URL || "http://localhost:5173",
            copyright: "TaskForge — thoughtful work starts with a clear plan."
        }
    });

    const emailTextual = mailGenerator.generatePlaintext(options.mailgenContent);
    const emailHtml = mailGenerator.generate(options.mailgenContent)
        .replaceAll("#22BC66", "#252623")
        .replaceAll("#22bc66", "#252623")
        .replaceAll("Arial, 'Helvetica Neue', Helvetica, sans-serif", "'Segoe UI', Arial, sans-serif");

    const transporter = nodemailer.createTransport({
        host: process.env.MAILTRAP_SMTP_HOST,
        port: process.env.MAILTRAP_SMTP_PORT,
        auth: {
            user: process.env.MAILTRAP_SMTP_USER,
            pass: process.env.MAILTRAP_SMTP_PASS,

        }
    })

    const mail = {
        from: process.env.MAIL_FROM || '"TaskForge" <no-reply@taskforge.local>',
        to: options.email,
        subject: options.subject,
        text: emailTextual,
        html: emailHtml
    }

    try {
        await transporter.sendMail(mail);
    } catch {
        throw new Error("Email delivery failed");
    }
}

const emailVerificationMailgenContent = (username, verificationUrl) => {
    return {
        body: {
            name: username,
            intro: "Welcome to TaskForge. Confirm your email address to get started with your workspace.",
            action:{
                instructions: "To verify your email please click on the following button",
                button: {
                    color: "#22BC66",
                    text: "Verify your TaskForge email",
                    link: verificationUrl
                },
            },
            outro: "If you did not create a TaskForge account, you can ignore this email."
        },
    };
};


const forgotPasswordMailgenContent = (username, passwordResetUrl) => {
    return {
        body: {
            name: username,
            intro: "We received a request to reset the password for your TaskForge account.",
            action:{
                instructions: "To reset your password click on the following button or link",
                button: {
                    color: "#22BC66",
                    text: "Reset your TaskForge password",
                    link: passwordResetUrl
                },
            },
            outro: "If you did not request a password reset, you can ignore this email."
        },
    };
};

export{
    emailVerificationMailgenContent,
    forgotPasswordMailgenContent,
    sendEmail
}; 


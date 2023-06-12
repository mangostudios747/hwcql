const { v4: uuidv4 } = require("uuid")
const jwt = require('jsonwebtoken');
const bcrypt = require("bcrypt")
const client = require('../mongo')
const { sendVerificationEmail, sendPasswordResetEmail } = require('../mailer.js')
const success = true

function getToken(uid) {
    return jwt.sign({ _id: uid }, process.env.JWT_SECRET, { expiresIn: '48h' })
}

function getVerificationToken(uid) {
    return jwt.sign({ _id: uid, mim: process.env.MIM_SECURITY }, process.env.JWT_SECRET, {})
}

async function getUser(token, client) {
    if (!token) return null;
    try {
        const { _id } = jwt.verify(token, process.env.JWT_SECRET)
        return await client.db().collection("users").findOne({ _id })
    }
    catch {
        return null
    }
}

function hashPassword(plaintext) {
    return bcrypt.hashSync(plaintext, 10)
}

function checkPassword(plaintext, hash) {
    return bcrypt.compareSync(plaintext, hash)
}

function createNewUser(email, username, password) {
    return {
        email,
        passwordHash: hashPassword(password),
        username,
        emailVerified: false,
        _id: "U."+uuidv4()
    }
}

module.exports = {
    getUser,
    AuthQueries: {
        user: async (_, { token }) => {
            const user = getUser(token, client);
            delete user.passwordHash
            return user
        },
        me: (_, __, { user }) => {
            return user
        }
    },
    AuthMutations: {
        login: async (_, { email, password }, { dataSources: { users } }) => {
            const user = await users.getUserByEmail(email);
            if (user && checkPassword(password, user.passwordHash)) {
                if (!user.emailVerified) {
                    return { error: "emailUnverified" }
                }
                return { token: getToken(user._id), success }
            }
            else return { error: "incorrectCredentials" }
        },
        register: async (_, { email, password, username }, { dataSources: { users } }) => {
            const exists = await users.getUserByEmail(email);
            if (!!exists) {
                console.log(exists)
                return {error: "accountExists"}
            }
            const doc = createNewUser(email, username, password)
            await client.db().collection("users").insertOne(doc)
            const verificationToken = getVerificationToken(doc._id)
            await sendVerificationEmail(doc.email, verificationToken)
            return {token: getToken(doc._id)}
        },
        verifyEmail: async (_, { token }) => {
            // decode the jwt
            const { mim, _id } = jwt.verify(token, process.env.JWT_SECRET)
            // check the MIM password
            // if incorrect call error
            if (mim !== process.env.MIM_SECURITY) { return { error: "tokenNotSecure" } }
            // update the user's email verification status
            await client.db().collection("users").updateOne({ _id }, { $set: { emailVerified: true } })
            // generate a login token
            return {token: getToken(_id), success}
            // send response
        },
        sendResetPasswordEmail: async (_, { email }, { dataSources: { users } }) => {
            // generate a unique token for the user
            const user = await users.getUserByEmail(email);
            if (!user) return { error: "UserNotFound" }
            const token = getVerificationToken(user._id);
            await sendPasswordResetEmail(user.email, token)
            return { success }
        },
        resetPassword: async (_, { token, newPassword }) => {
            // decode the jwt
            const { mim, _id } = jwt.verify(token, process.env.JWT_SECRET)
            // check the MIM password
            // if incorrect call error
            if (mim !== process.env.MIM_SECURITY) { return { error: "tokenNotSecure" } }
            // update the passwordHash
            await client.db().collection("users").updateOne({ _id }, { $set: { passwordHash: hashPassword(newPassword) } })
            return { token: getToken(_id), success }
        },
        deleteAccount: async (_, { password }, { user }) => {
            // check if `user.passwordHash` matches `password`
            if (checkPassword(password, user.passwordHash)){
                // if so then dig into user db and DELETE
                await client.db().collection("users").deleteOne({ _id: user._id })
                console.log(`deleted user ${user.username}<${user._id}>`)
                return { success }
            }
            // if not then return an error
            return { error: "incorrectCredentials" }
        },
        changeEmail: async (_, { newEmail, password }, { user }) => {
            if (!checkPassword(password, user.passwordHash)) return;
            // it's the user! update their 
            await client.db().collection("users").updateOne({ _id }, { $set: { emailVerified: false, email: newEmail } })

        }
    }
}
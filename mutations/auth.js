const { v4: uuidv4 } = require("uuid")
const jwt = require('jsonwebtoken');
const bcrypt = require("bcrypt")
const client = require('../mongo')
const { sendVerificationEmail } = require('../mailer.js')

function getToken(uid) {
    return jwt.sign({ _id: uid }, process.env.JWT_SECRET, { expiresIn: '1h' })
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
        _id: uuidv4()
    }
}

module.exports = {
    getUser,
    AuthMutations: {
        login: async (_, { email, password }, { dataSources: { users } }) => {
            const user = await users.getUserByEmail(email);
            if (user && checkPassword(password, user.passwordHash)) {
                if (!user.emailVerified) {
                    return { error: "emailUnverified" }
                }
                return { token: getToken(user._id) }
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
            await sendVerificationEmail(doc.email, verificationToken, process.env.HOST)
            return {token: getToken(doc._id)}
        },
        verifyEmail: async (_, { token }, { dataSources: { users } }) => {
            // decode the jwt
            const { mim, _id } = jwt.verify(token, process.env.JWT_SECRET)
            // check the MIM password
            // if incorrect call error
            if (mim !== process.env.MIM_SECURITY) { return { error: "tokenNotSecure" } }
            // update the user's email verification status
            await client.db().collection("users").updateOne({ _id }, { $set: { emailVerified: true } })
            // generate a login token
            return {token: getToken(_id)}
            // send response
        }
    }
}
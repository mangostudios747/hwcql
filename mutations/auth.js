const { v4: uuidv4 } = require("uuid")
const jwt = require('jsonwebtoken');
const bcrypt = require("bcrypt")
const client = require('../mongo')

function getToken(uid) {
    return jwt.sign({ _id: uid }, process.env.JWT_SECRET, { expiresIn: '1h' })
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

function hashPassword(plaintext){
    return bcrypt.hashSync(plaintext, 10)
}

function checkPassword(plaintext, hash){
    return bcrypt.compareSync(plaintext, hash)
}

module.exports = {
    getUser,
    AuthMutations: {
        login: async (_, { email, password }, { dataSources: { users } }) => {
            const user = await users.getUserByEmail(email);
            if (user && checkPassword(password, user.passwordHash)) {
                return getToken(user._id)
            }
            else return null
        },
        register: async (_, { email, password, username }, { dataSources: { users } }) => {
            const exists = await users.getUserByEmail(email);
            if (!!exists) {
                console.log(exists)
                return exists
            }
            else {
                const doc = {
                    email,
                    passwordHash: hashPassword(password),
                    username,
                    _id: uuidv4()
                }
                await client.db().collection("users").insertOne(doc)
                return getToken(doc._id)
            }
        }
    }
}
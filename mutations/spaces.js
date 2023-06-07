const { v4: uuidv4 } = require("uuid")
const client = require('../mongo')

module.exports = {
    SpacesQueries: {
        async spaceByID(_, { id: space_id }, { user }){
            const space = await client.db().collection("spaces").findOne({_id: space_id, "members.user_id": user._id})
            if (!space) {
                return new Error("space does not exist")
            }
            return space
        }

    },
    SpacesMutations: {
        async newSpace(_, { title }, { user }){
            const doc = {
                title,
                members: [ {
                    owner: true,
                    user_id: user._id
                } ],
                _id: "S."+uuidv4(),
                rootNotes: []
            }
            await client.db().collection("spaces").insertOne(doc);
            return doc;
        },
        async newRootNote(_, { space: space_id, title }, { user }){
            const space = await client.db().collection("spaces").findOne({_id: space_id, "members.user_id": user._id})
            // this way nobody knows if the space doesnt exist or the user lacks access.
            if (!space) {
                return new Error("space does not exist")
            }
            const doc = {
                _id: "N."+uuidv4(),
                title,
                parentNoteID: space._id,
                spaceID: space._id,
                createdBy: user._id
            }
            await client.db().collection("notes").insertOne(doc);
            return doc
        }
    }
 }
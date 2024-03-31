import { Firestore } from "firebase-admin/firestore"

export enum SubscriberConsistency {
    STRONG = "STRONG",
    WEAK = "WEAK"
}

export type SubscriberLocation = { api: string, consistency: SubscriberConsistency }

export type Subscriber = SubscriberLocation & { events: string[] }

interface SubscribersDB {
    saveSubscriber(subscriber: Subscriber): Promise<void>
    deleteSubscriber(api: string): Promise<void>,
    query(eventType: string): Promise<SubscriberLocation[]>
}

function FirebaseSubscribersDB(db: Firestore): SubscribersDB {
    return {
        async saveSubscriber(subscriber: Subscriber) {
            await db.collection("subscribers").doc(subscriber.api).set(subscriber)
        },
        async deleteSubscriber(api: string) {
            await db.collection("subscribers").doc(api).delete()
        },
        async query(eventType: string) {
            const docs = await db.collection("subscibrers").where("events", "array-contains", eventType).get()
            const subscribers: SubscriberLocation[] = []
            docs.forEach(d => {
                const data = d.data()
                subscribers.push({ api: data.api, consistency: data.consistency })
            })
            return subscribers
        }

    }
}



export default FirebaseSubscribersDB

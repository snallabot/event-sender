import { Firestore } from "firebase-admin/firestore"
import { randomUUID } from "crypto"

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
            await db.collection("subscribers").doc(randomUUID()).set(subscriber)
        },
        async deleteSubscriber(api: string) {
            const docs = await db.collection("subscribers").where("api", "==", api).get()
            const promises: Array<Promise<any>> = []
            docs.forEach(doc => promises.push(doc.ref.delete()))
            await Promise.all(promises)
        },
        async query(eventType: string) {
            const subs = await db.collection("subscribers").where("events", "array-contains", eventType).get()
            return subs.docs.map(d => d.data() as SubscriberLocation)
        }

    }
}



export default FirebaseSubscribersDB

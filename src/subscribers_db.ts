import { initializeApp, cert } from "firebase-admin/app"
import { getFirestore } from "firebase-admin/firestore"

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

function setupFirebase() {
    // production, use firebase with SA credentials passed from environment
    if (process.env.SERVICE_ACCOUNT) {
        const serviceAccount = JSON.parse(process.env.SERVICE_ACCOUNT)
        initializeApp({
            credential: cert(serviceAccount)
        })

    }
    // dev, use firebase emulator
    else {
        if (!process.env.FIRESTORE_EMULATOR_HOST) {
            throw new Error("Firestore emulator is not running!")
        }
        initializeApp({ projectId: "dev" })
    }
    return getFirestore()
}



const FirebaseSubscribersDB: () => SubscribersDB = () => {
    const db = setupFirebase()
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

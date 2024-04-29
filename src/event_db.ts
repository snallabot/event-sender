import { randomUUID } from "crypto"
import { Firestore, Timestamp } from "firebase-admin/firestore"

type EventId = string
export type SnallabotEvent = { key: string, event_type: string, [key: string]: any }
export type StoredEvent = SnallabotEvent & { timestamp: Date, id: EventId }

interface EventDB {
    appendEvents(event: Array<SnallabotEvent>): Promise<void>
    queryEvents(event_type: string, key: string, after: Date): Promise<StoredEvent[]>
}

function convertDate(firebaseObject: any) {
    if (!firebaseObject) return null;

    for (const [key, value] of Object.entries(firebaseObject)) {

        // covert items inside array
        if (value && Array.isArray(value))
            firebaseObject[key] = value.map(item => convertDate(item));

        // convert inner objects
        if (value && typeof value === 'object') {
            firebaseObject[key] = convertDate(value);
        }

        // convert simple properties
        if (value && value.hasOwnProperty('_seconds'))
            firebaseObject[key] = (value as Timestamp).toDate();
    }
    return firebaseObject;
}

function FirebaseEventDB(db: Firestore): EventDB {
    return {
        async appendEvents(events: Array<SnallabotEvent>) {
            const batch = db.batch()
            console.log(events)
            events.forEach(event => {
                console.log(event)
                const eventId = randomUUID()
                const doc = db.collection("events").doc(event.key).collection(event.event_type).doc(eventId)
                batch.set(doc, { ...event, timestamp: new Date(), id: eventId })
            })
            await batch.commit()
        },
        async queryEvents(key: string, event_type: string, after: Date) {
            const events = await db.collection("events").doc(key).collection(event_type).where("timestamp", ">", after).get()
            return events.docs.map(doc => convertDate(doc.data()) as StoredEvent)
        }
    }
}

export default FirebaseEventDB

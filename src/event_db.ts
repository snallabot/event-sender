import { randomUUID } from "crypto"
import { Firestore } from "firebase-admin/firestore"

type EventId = string
export type SnallabotEvent = { key: string, event_type: string, [key: string]: any }
export type StoredEvent = SnallabotEvent & { timestamp: Date, id: EventId }

interface EventDB {
    appendEvent(event: SnallabotEvent): Promise<void>
    queryEvents(event_type: string, key: string): Promise<StoredEvent[]>
}

function FirebaseEventDB(db: Firestore): EventDB {
    return {
        async appendEvent(event: SnallabotEvent) {
            const eventId = randomUUID()
            const doc = db.collection("events").doc(event.key).collection(event.event_type).doc(eventId)
            await doc.set({ ...event, timestamp: new Date(), id: eventId })
        },
        async queryEvents(event_type: string, key: string) {
            const events = await db.collection("events").doc(key).collection(event_type).get()
            const storedEvents = [] as StoredEvent[]
            events.forEach(d => storedEvents.push((d.data() as StoredEvent)))
            return storedEvents
        }
    }
}

export default FirebaseEventDB

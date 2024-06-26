import Koa from "koa"
import Router from "@koa/router"
import bodyParser from "@koa/bodyparser"
import SubscribersDB, { Subscriber, SubscriberConsistency } from "./subscribers_db"
import EventDB, { SnallabotEvent } from "./event_db"
import { initializeApp, cert } from "firebase-admin/app"
import { getFirestore, Firestore } from "firebase-admin/firestore"


const app = new Koa()
const router = new Router()

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

const db: Firestore = setupFirebase()
const subcribersDB = SubscribersDB(db)
const eventDB = EventDB(db)

type QueryRequest = {
    key: string, event_types: string[], after: number, filter: {
        [key: string]: any
    }, limit: number
}

async function retryingPromise(future: () => Promise<Response>, maxTries: number = 5): Promise<Response> {
    let count = 0
    while (count < maxTries) {
        const res = await future()
        if (res.ok) {
            return res
        } else {
            count = count + 1
        }
    }
    throw Error("Failed to post event")
}

enum Delivery {
    EVENT_TRANSFER = "EVENT_TRANSFER",
    EVENT_SOURCE = "EVENT_SOURCE"
}

async function sendEvent(incomingEvents: Array<SnallabotEvent>, delivery: Delivery): Promise<void> {
    if (delivery === "EVENT_SOURCE") {

        await eventDB.appendEvents(incomingEvents)
    }
    const event_types = [...new Set(incomingEvents.map(e => e.event_type))]
    await Promise.all(event_types.map(async event_type => {
        const subscribers = await subcribersDB.query(event_type)
        console.log(subscribers)
        const strongConsistency = subscribers.filter(s => s.consistency === SubscriberConsistency.STRONG)
        const weakConsistency = subscribers.filter(s => s.consistency === SubscriberConsistency.WEAK)
        const events = incomingEvents.filter(e => e.event_type === event_type)
        weakConsistency.map(api =>
            Promise.all(events.map(incomingEvent =>
                fetch(api.api, {
                    method: "POST",
                    body: JSON.stringify(incomingEvent),
                    headers: {
                        "Content-Type": "application/json"
                    }
                })))
        )
        await Promise.all(strongConsistency.map(api =>
            Promise.all(events.map(incomingEvent =>
                retryingPromise(() => fetch(api.api, {
                    method: "POST",
                    body: JSON.stringify(incomingEvent),
                    headers: {
                        "Content-Type": "application/json"
                    }
                }))))))
    }))
}


type PostSenderRequest = SnallabotEvent & { delivery: Delivery }
type BatchPostSenderRequest = { delivery: Delivery, batch: Array<SnallabotEvent> }
router.post("/subscribe", async (ctx) => {
    const req = ctx.request.body as Subscriber
    await subcribersDB.saveSubscriber(req)
    ctx.status = 200
})
    .post("/unsubscribe", async (ctx) => {
        const apiReq = ctx.request.body as { api: string }
        await subcribersDB.deleteSubscriber(apiReq.api)
        ctx.status = 200
    })
    .post("/post", async (ctx, next) => {
        const incomingEvent = ctx.request.body as PostSenderRequest
        ctx.status = 202
        await next()
        const { delivery, ...event } = incomingEvent
        await sendEvent([event], delivery)
    })
    .post("/batchPost", async (ctx, next) => {
        const incomingEvent = ctx.request.body as BatchPostSenderRequest
        ctx.status = 202
        await next()
        await sendEvent(incomingEvent.batch, incomingEvent.delivery)
    })
    .post("/query", async (ctx) => {
        const queryReq = ctx.request.body as QueryRequest
        const events = await Promise.all(queryReq.event_types.map((event_type) => {
            return eventDB.queryEvents(queryReq.key, event_type, new Date(queryReq.after), queryReq.filter || {}, queryReq.limit || 1000).then(e => ({ [event_type]: e }))
        }))
        ctx.response.body = Object.assign({}, ...events)
    })


app.use(bodyParser({ enableTypes: ["json"], encoding: "utf-8" }))
    .use(async (ctx, next) => {
        try {
            await next()
        } catch (err: any) {
            console.error(err)
            ctx.status = 500;
            ctx.body = {
                message: err.message
            };
        }
    })
    .use(router.routes())
    .use(router.allowedMethods())

export default app

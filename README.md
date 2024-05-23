# event-sender
an event sender for madden related events. This distributes events to many consumers while also keeping a store of every event sent. Documentation of the current events TBD.

## API

All REST calls can be made to this endpoint. They are json requests and require the content type header. 

```
deployment: https://snallabot-event-sender-b869b2ccfed0.herokuapp.com/
```

### Subscribe

```
/subscribe
```

POST request to add your server as a subscriber to events. 

| Body Parameter | Description | Type
| --- | ---- | --- |
| api | The url that will be called with subscribed events | String |
| consistency | STRONG or WEAK . If you are not sure which to use, use WEAK. STRONG guarantees that your server completes the request and will retry calls. This should be unnecessary for most cases | Enum, STRONG, WEAK |
| events | a list of event names that you are subscribing to | List of String | 

```
/unsubscribe
```

POST request to remove your server as a describer

| Body Parameter | Description | Type
| --- | ---- | --- |
| api | The url that will be removed | String |

### Events

```
/post
```

POST request to send an event 

| Body Parameter | Description | Type
| --- | ---- | --- |
| key | the key of the event, this makes it queryable | String |
| event_type | a unique identifying event name | String |
| delivery | how the event will be processed. `EVENT_SOURCE` means the event will be appended to a log for retrieval and signal subcribers. `EVENT_TRANSFER` means the event will only be used as a trigger and will not be used for any later processing/business logic. If you need to retrieve this event data at a later point use `EVENT_SOURCE`. | `EVENT_SOURCE, EVENT_TRANSFER`

Any other fields can be added and will be retrievable. The above are required

```
/batchPost
```

POST request to send a batch of events

| Body Parameter | Description | Type
| --- | ---- | --- |
| batch | list of events | list of event with `key` and `event_type` per event |
| delivery | how the event will be processed. `EVENT_SOURCE` means the event will be appended to a log for retrieval and signal subcribers. `EVENT_TRANSFER` means the event will only be used as a trigger and will not be used for any later processing/business logic. If you need to retrieve this event data at a later point use `EVENT_SOURCE`. | `EVENT_SOURCE, EVENT_TRANSFER`

Any other fields can be added and will be retrievable. The above are required


```
/query
```

POST request to retrieve events

| Body Parameter | Description | Type
| --- | ---- | --- |
| key | the key of the event you are querying for | String |
| event_types | the events you are querying for  | List of String |
| after | the time after to query events for | Integer, milliseconds since Epoch |
| filter | key value pairs to match events on. If the event has field `x` with value `y`, this should look like `{"x": y}` | key value pair object |
| limit | the number of events to return, timestamp in descending order, Default is 1000 | Integer

example:

```js
  await fetch(
    "https://snallabot-event-sender-b869b2ccfed0.herokuapp.com/post",
    {
      method: "POST",
      body: JSON.stringify({
        key: "time",
        event_type: "5_MIN_TRIGGER",
        delivery: "EVENT_TRANSFER",
      }),
      headers: {
        "Content-Type": "application/json",
      },
    }
  )
```

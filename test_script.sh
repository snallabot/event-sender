#! /bin/sh

curl -X POST localhost:3000/post  -H "Content-Type: application/json" --data '{"key": "test_key", "event_type": "TEST_EVENT", "a1": "b1", "a2": "b2", "delivery": "EVENT_SOURCE"}'
curl -X POST localhost:3000/post  -H "Content-Type: application/json" --data '{"key": "test_key", "event_type": "TEST_EVENT", "a3": "b3", "delivery": "EVENT_SOURCE"}'
curl -X POST localhost:3000/query  -H "Content-Type: application/json" --data '{"key": "test_key", "event_types": ["TEST_EVENT"], "after": 0, "limit": 3}'


#!/bin/bash
cd backend
mvn spring-boot:run &
PID=$!
sleep 15
curl -I http://localhost:8080/api/health
kill $PID
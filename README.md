# hn-cli
A simple Hacker News terminal client.

## Prerequistes
* Node 8+

## Installation
1. Clone the repository
2. In the repo directory, run `npm install`

## Usage
In repo directory, run `node index`

## Issue of Intalling Firebase at Node 11

At Node 11, it may be failed to install `firebase` due to build error of its dep `grpc`, try using latest gcc (8+) with `CXXFLAGS` as follow

    env CXXFLAGS="-Wno-ignored-qualifiers -Wno-stringop-truncation -Wno-cast-function-type" npm install

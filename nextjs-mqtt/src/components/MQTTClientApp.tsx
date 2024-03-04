"use client"

import { PropsWithChildren, ReactNode, createContext, useEffect, useState } from "react"
import mqtt, { MqttClient } from "mqtt"
import * as pino from "pino"

const log = pino.pino()

export type MQTTClientAppProps = {
    serverConfig: {
        url: string;
    };
}

export type MQTTClientContext = {
    client: MqttClient|null
}

export const MQTTClientContext = createContext<MQTTClientContext|null>(null)

export const MQTTClientApp = ({
    serverConfig, children
}: PropsWithChildren<MQTTClientAppProps>) => {

    const [mqttClient,setMqttClient] = useState<MqttClient|null>(null)

    useEffect(() => {
        const client = mqtt.connect(serverConfig.url,{
            manualConnect: true
        })
    
        client.on("connect",(connack) => {
            log.info("mqtt client connect")
        })
    
        client.on("reconnect",() => {
            log.info("mqtt client reconnect")
        })
    
        client.on("error",(error) => {
            log.info(`mqtt client error ${error}`)
        })
    
        client.on("disconnect",(packet) => {
            log.info("mqtt client disconnect")
        })
    
        client.on("offline",() => {
            log.info("mqtt client offline")
        })
    
        client.on("close",() => {
            log.info("mqtt client close")
        })
    
        client.on("end",() => {
            log.info("mqtt client end")
        })

        setMqttClient(client)
    
        log.info(`client.connect()...`)
        client.connect()

        return () => {
            log.info(`client.end()...`)
            client.end()
        }
    },[serverConfig.url])

    return(
        <MQTTClientContext.Provider value={{client:mqttClient}}>
            {children}
        </MQTTClientContext.Provider>
    )
}
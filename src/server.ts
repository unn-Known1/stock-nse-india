/* eslint-disable no-console */
import 'dotenv/config'
import express from 'express'
import http from 'http';
import https from 'https';
import fs from 'fs';
import swaggerUi from 'swagger-ui-express'
import { ApolloServer } from 'apollo-server-express';
import { ApolloServerPluginDrainHttpServer } from 'apollo-server-core';
import { print } from 'graphql'
import { loadSchemaSync } from '@graphql-tools/load'
import { loadFilesSync } from '@graphql-tools/load-files'
import { mergeTypeDefs, mergeResolvers } from '@graphql-tools/merge'
import { GraphQLFileLoader } from '@graphql-tools/graphql-file-loader'
import { openapiSpecification } from './swaggerDocOptions.js'
import path from 'path';
import { mainRouter } from './routes.js'
import cors from 'cors';

function validateConfig(): void {
  const portNum = parseInt(process.env.PORT || '3000', 10)
  if (Number.isNaN(portNum) || portNum < 1 || portNum > 65535) {
    console.warn(`Invalid PORT "${process.env.PORT}", defaulting to 3000`)
  }

  const apiKey = process.env.OPENAI_API_KEY
  if (apiKey && apiKey.length > 0) {
    const baseUrl = process.env.OPENAI_BASE_URL
    if (!baseUrl && !/^sk-[A-Za-z0-9]{20,}$/.test(apiKey)) {
      console.warn('OPENAI_API_KEY format looks invalid (expected sk-...). If using a compatible provider, set OPENAI_BASE_URL.')
    }
  } else {
    console.log('OPENAI_API_KEY not set — AI Assistant and MCP query endpoints will be unavailable.')
  }

  if (!process.env.CORS_ORIGINS) {
    console.log('CORS_ORIGINS not set — only localhost requests allowed.')
  }

  if (process.env.HTTPS_ENABLED === 'true') {
    const keyPath = process.env.SSL_KEY_PATH
    const certPath = process.env.SSL_CERT_PATH
    if (!keyPath || !certPath) {
      console.warn('HTTPS is enabled but SSL_KEY_PATH or SSL_CERT_PATH is not set.')
    }
  }
}

validateConfig()

const app = express()
app.disable('x-powered-by')
const port = process.env.PORT || 3000
const isHttpsEnabled = process.env.HTTPS_ENABLED === 'true'
const protocol = isHttpsEnabled ? 'https' : 'http'
const configuredHostUrl = process.env.HOST_URL?.trim()
const hostUrl = configuredHostUrl
  ? configuredHostUrl.replace(/^https?:\/\//, `${protocol}://`)
  : `${protocol}://localhost:${port}`

// CORS Configuration from environment variables
// CORS_ORIGINS: Comma-separated list of allowed origins
// CORS_METHODS: Comma-separated list of allowed HTTP methods  
// CORS_HEADERS: Comma-separated list of allowed headers
// CORS_CREDENTIALS: Enable/disable credentials (default: true)

// Enable CORS for all routes
const corsOrigins = process.env.CORS_ORIGINS ? 
  process.env.CORS_ORIGINS.split(',').map(origin => origin.trim()) : 
  [];

const corsMethods = process.env.CORS_METHODS ? 
  process.env.CORS_METHODS.split(',').map(method => method.trim()) : 
  ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'];

const corsHeaders = process.env.CORS_HEADERS ? 
  process.env.CORS_HEADERS.split(',').map(header => header.trim()) : 
  ['Content-Type', 'Authorization'];

app.use(cors({
  origin: [
    ...corsOrigins,
    /^https:\/\/studio\.apollographql\.com$/, // Allow Apollo Studio
    /^https:\/\/.*\.graphql\.com$/, // Allow GraphQL clients
    /^http:\/\/localhost:\d+$/,  // Allow any localhost port
    /^https:\/\/localhost:\d+$/, // Allow any localhost HTTPS port
    /^http:\/\/127\.0\.0\.1:\d+$/, // Allow any 127.0.0.1 port
    /^https:\/\/127\.0\.0\.1:\d+$/ // Allow any 127.0.0.1 HTTPS port
  ],
  methods: corsMethods,
  allowedHeaders: corsHeaders,
  credentials: process.env.CORS_CREDENTIALS !== 'false',
  maxAge: 86400
}));

// Add JSON body parsing middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve dashboard static files from same origin (for tunnel/remote access)
const dashboardPath = path.resolve(__dirname, '../dashboard')
if (fs.existsSync(dashboardPath)) {
  app.use(express.static(dashboardPath))
  console.log(`Dashboard served from: ${dashboardPath}`)
}

app.get('/health', (req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }))
app.use(mainRouter)
app.use('/api-docs', swaggerUi.serve as any);
app.use('/api-docs', swaggerUi.setup(openapiSpecification) as any);

const loadedTypeDefs = loadSchemaSync(path.join(__dirname, './**/*.graphql'), { loaders: [new GraphQLFileLoader()] })
const loadedResolvers = loadFilesSync(path.join(__dirname, './**/*.resolver.{ts,js}'))

const typeDefs = mergeTypeDefs(loadedTypeDefs)

if (process.env.NODE_ENV === 'development') {
    console.log('\n=== GraphQL Schema Start ===\n')
    const printedTypeDefs = print(typeDefs)
    console.log(printedTypeDefs)
    console.log('\n=== GraphQL Schema End ===\n')
    
}

const resolvers = mergeResolvers(loadedResolvers)

function isPathInsideProject(filePath: string): boolean {
    const resolved = path.resolve(filePath)
    const projectDir = path.resolve(process.cwd())
    return resolved.startsWith(projectDir)
}

const rawSslKeyPath = process.env.SSL_KEY_PATH || path.resolve(process.cwd(), 'certs/localhost-key.pem')
const rawSslCertPath = process.env.SSL_CERT_PATH || path.resolve(process.cwd(), 'certs/localhost.pem')

if (!isPathInsideProject(rawSslKeyPath) || !isPathInsideProject(rawSslCertPath)) {
    throw new Error('SSL key/cert path must be within the project directory')
}

const sslKeyPath = rawSslKeyPath
const sslCertPath = rawSslCertPath

const networkServer = isHttpsEnabled
  ? (() => {
      if (!fs.existsSync(sslKeyPath) || !fs.existsSync(sslCertPath)) {
        throw new Error(`HTTPS cert files not found. Checked key: ${sslKeyPath}, cert: ${sslCertPath}`)
      }

      return https.createServer(
        {
          key: fs.readFileSync(sslKeyPath),
          cert: fs.readFileSync(sslCertPath),
        },
        app
      )
    })()
  : http.createServer(app)

const server = new ApolloServer({
    typeDefs,
    resolvers,
    plugins: [ApolloServerPluginDrainHttpServer({ httpServer: networkServer as unknown as http.Server })]
});

server.start().then(() => {
    server.applyMiddleware({ app });
    networkServer.listen(port, () => {
        console.log(`NseIndia App started in port ${port}`);
        console.log(`For API docs: ${hostUrl}/api-docs`);
        console.log(`Open ${hostUrl} in browser.`);
        console.log(`For graphql: ${hostUrl}${server.graphqlPath}`);
        console.log(`Server mode: ${isHttpsEnabled ? 'HTTPS' : 'HTTP'}`);
        
        // Log CORS configuration
        if (corsOrigins.length > 0) {
            console.log(`CORS Origins: ${corsOrigins.join(', ')}`);
        }
        console.log(`CORS Methods: ${corsMethods.join(', ')}`);
        console.log(`CORS Headers: ${corsHeaders.join(', ')}`);
        console.log(`CORS Credentials: ${process.env.CORS_CREDENTIALS !== 'false'}`);
    })
})

process.on('unhandledRejection', (reason) => {
    console.error('Unhandled Rejection:', reason)
})

process.on('SIGTERM', () => { console.log('SIGTERM received, shutting down...'); networkServer.close(() => process.exit(0)); });
process.on('SIGINT', () => { console.log('SIGINT received, shutting down...'); networkServer.close(() => process.exit(0)); });

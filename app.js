import express from 'express'
import session  from 'express-session'
import bodyParser  from 'body-parser'
import fs from 'fs'
import logger from './logger.js'
import 'dotenv/config'
import { Calculator } from './calcs/Calculator.js'
import { AuthController } from './auth/AuthController.js'
import { createClient } from 'redis'
import RedisStore from 'connect-redis'

let [sideMenu] = await Promise.all([
    fs.promises.readFile('./sideMenu.json', 'utf8').then(JSON.parse)
])
const app = express()

app.use(bodyParser.urlencoded({ extended: true }))
app.use(bodyParser.json())
app.use(express.static('public'))
app.use((err, req, res, next) => {
    logger.error(`Error: ${err.message}`)
    res.status(500).send('Something broke!')
});
// Настройка сессий
let redisClient = createClient()
redisClient.connect().catch(console.error)
let redisStore = new RedisStore({
  client: redisClient,
  prefix: "columbCalc",
})
app.use(session({
    store: redisStore,
    secret: process.env.SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 10000}
}));

app.set('view engine', 'pug')
app.set('views', './views')

app.get('/', (req, res) => {
    req.session.isAuthenticated ? res.render('layouts/main', {sideMenu}) : res.render('layouts/index')
});
const authController = new AuthController
app.post('/login', async(req, res) => authController.login(req, res))
    
const calculator = new Calculator()

app.post('/selfcostupdate', (req, res) => calculator.updateSelfcost(req.body, res))

app.use(authController.authenticate)

app.use((req, res, next) => {
    logger.info(`${req.method} ${req.url} ${req.session.userId}`)
    next();
});
app.get('/main', (req, res) => res.render('layouts/main', {sideMenu}))

app.get('/main/:calc', (req, res) => calculator.renderCalcs(req, res, sideMenu))

app.post('/main/:calc', (req, res) => calculator.updateUserProps(req, res))

app.post('/main/save/:calc', async (req, res) => calculator.saveHistory(req, res));

app.post('/main/del/:calc', async (req, res) => calculator.deleteHistory(req, res))

app.post('/main/edit/:calc', async (req, res) => calculator.editHistory(req, res))

const PORT = process.env.PORT

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`)
    logger.info(`Server running on http://localhost:${PORT}`)
})
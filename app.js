import express from 'express'
import session  from 'express-session'
import bodyParser  from 'body-parser'
import logger from './logger.js'
import 'dotenv/config'
import { Calculator } from './calcs/Calculator.js'
import { AuthController } from './auth/AuthController.js'
import { createClient } from 'redis'
import RedisStore from 'connect-redis'
import sideMenu from './sideMenu.json' assert {type: 'json'}
import { OzonController } from './ozon/OzonController.js'


const app = express()

app.use(bodyParser.urlencoded({ extended: true }))
app.use(bodyParser.json())
app.use(express.static('public'))
app.use((err, req, res, next) => {
    logger.error(`Error: ${err.message}`)
    res.status(500).send('Something broke!')
});
// Настройка сессий
export const redisClient = createClient()
redisClient.connect().catch(console.error)
const redisStore = new RedisStore({
  client: redisClient,
  prefix: "columbCalc",
})
app.use(session({
    store: redisStore,
    secret: process.env.SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 86400000}
}));

app.set('view engine', 'pug')
app.set('views', './views')

app.get('/', (req, res) => {
    req.session.isAuthenticated ? res.render('layouts/main', {sideMenu}) : res.render('layouts/index')
});
const authController = new AuthController()

app.post('/login', (req, res) => authController.login(req, res));

    
const calculator = new Calculator()
const ozon = new OzonController()

setTimeout(() => ozon.updateAllProducts(), 3_600_000)
app.post('/selfcostupdate', calculator.updateSelfcost)

app.post('/changeFromSklad', (req, res) => ozon.hookUpdateStockOzon(req, res))
app.post('/changeFromOzon', (req, res) => ozon.ozonHook(req, res))
app.post('/massChangeOzon', (req, res) => ozon.massUpdateOzon(req, res))
app.use(authController.authenticate)

app.use((req, res, next) => {
    logger.info(`${req.method} ${req.url} ${req.session.userId}`)
    next();
});
app.get('/ozon', (req, res) => ozon.renderOzon(req, res, sideMenu))

app.post('/ozon/:action', (req, res) => ozon[req.params.action](req, res))

app.get('/main', (req, res) => res.render('layouts/main', {sideMenu}))

app.get('/:calc', (req, res) => calculator.renderCalcs(req, res, sideMenu))

app.post('/:calc', (req, res) => calculator.updateUserProps(req, res))

app.post('/save/:calc', (req, res) => calculator.saveHistory(req, res));

app.post('/del/:calc',(req, res) =>  calculator.deleteHistory(req, res))

app.post('/edit/:calc', (req, res) => calculator.editHistory(req, res))

const PORT = process.env.PORT

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`)
    logger.info(`Server running on http://localhost:${PORT}`)
})

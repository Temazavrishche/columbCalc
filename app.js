import express from 'express'
import session  from 'express-session'
import bodyParser  from 'body-parser'
import fs from 'fs'
import bcrypt from 'bcrypt'
import { ballons } from './calcs/ballons.js'
import { mattress } from './calcs/mattress.js'
import { fbort } from './calcs/fbort.js'
import axios from "axios"
import logger from './logger.js'

const calculators = {
    ballons,
    mattress,
    fbort
}
let [users, history, sideMenu] = await Promise.all([
    fs.promises.readFile('./users.json', 'utf8').then(JSON.parse),
    fs.promises.readFile('./history.json', 'utf8').then(JSON.parse),
    fs.promises.readFile('./sideMenu.json', 'utf8').then(JSON.parse)
]);
let selfcost
await axios.get('https://script.google.com/macros/s/AKfycbzYqyd5HrOxJOwdyZTsQMT1GrPIXG2qbeEKpnj5Ll5oLPonF382DExv2Gd04LdXhMeVEg/exec').then(req =>{selfcost = req.data}).catch(error => {logger.error(`Error: ${error}`)})

const lastUserProps = {}
users.forEach(user => {
    lastUserProps[user.id] = {
        ballons: {
            diameter: 600,
            length: 5000,
            rollWidth: 2050,
            partitions: 0,
            shape: 3,
            fabric: 850,
            reinforcement: 'none',
            mounting: 'none'
        },
        mattress: {
            length: 2000,
            width: 1000,
            height: 230,
            fabric: 650
        },
        fbort: {
            straightLength: 1900,
            lengthWithRadius: 1800,
            diameter: 250,
            fromCenterToTurn: 675,
            fromCenterToEnd: 0,
            rollWidth: 2050,
            addPartitions: 0,
            fabric: 850
        }
    }
});
const app = express();

const PORT = 80;
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('public'));
app.use((req, res, next) => {
    logger.info(`${req.method} ${req.url}`); // Логирование метода и URL
    next();
});
app.use((err, req, res, next) => {
    logger.error(`Error: ${err.message}`); // Логирование ошибок
    res.status(500).send('Something broke!');
});
// Настройка сессий
app.use(session({
    secret: "e7edb34220c7149221bf26f2a1506db0a608b0437d543ce54682321e112cb1ed7d3cbd30a35f9da30a48a94817f58820ac88b69cc9a5c15",
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 2419200000}
}));

app.set('view engine', 'pug');
app.set('views', './views');

app.get('/', (req, res) => {
    req.session.isAuthenticated ? res.render('layouts/main', {sideMenu}) : res.render('layouts/index')
});

app.post('/login', async(req, res) => {
    const { password, username } = req.body;
    const user = users.find(user => user.username === username);
    if(!user) {
        res.render('layouts/index', {username, error: true});
    }
    if(await bcrypt.compare(password, user.password)) {
        req.session.isAuthenticated = true;
        req.session.userRole = user.role;
        req.session.userId = user.id
        res.redirect('/main');
    }else {
        res.render('layouts/index', {username, error: true});
    }
})
app.post('/selfcostupdate', async(req, res) => {
    selfcost = req.data
    res.send(200)
})
app.use(authenticate)
app.get('/main', (req, res) => {
    res.render('layouts/main', {sideMenu})
})

app.get('/main/:calc', (req, res) => {
    const result = calculators[req.params.calc](lastUserProps[req.session.userId][req.params.calc], selfcost)
    renderCalcs(req,res, {result: result})
});

app.post('/main/:calc', (req, res) => {
    lastUserProps[req.session.userId][req.params.calc] = req.body
    res.redirect(`/main/${req.params.calc}`)
})

app.post('/main/save/:calc', async (req, res) => {
    const result = calculators[req.params.calc](lastUserProps[req.session.userId][req.params.calc], selfcost)
    const dataForSave = {
        initialData: lastUserProps[req.session.userId][req.params.calc],
        calcs: result,
        markup: req.body.markup,
        comments: req.body.comments,
        meta: { author: foundUserById(req.session.userId).username,
                date: new Date()
        }
    }
    history[req.params.calc][++history.id] = dataForSave
    await saveHistory();
    res.redirect(`/main/${req.params.calc}`)
});

app.post('/main/del/:calc', async (req, res) => {
    delete history[req.params.calc][req.body.id]
    await saveHistory()
    res.redirect(`/main/${req.params.calc}`)
});

app.post('/main/edit/:calc', async (req, res) => {
    history[req.params.calc][req.body.id].comments = req.body.comments
    history[req.params.calc][req.body.id].markup = req.body.markup
    await saveHistory();
    res.redirect(`/main/${req.params.calc}`)
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`)
    logger.info(`Server running on http://localhost:${PORT}`)
});

const renderCalcs = (req,res, args = {}) =>{
    const commonArgs = {
        img: `/img/${req.params.calc}.png`,
        sideMenu,
        current: req.params.calc,
        last: lastUserProps[req.session.userId][req.params.calc],
        history: history[req.params.calc]
    }
    res.render(`calcs/${req.params.calc}`, {...commonArgs, ...args});
}
const saveHistory = async () => {
    try {
        await fs.promises.writeFile('./history.json', JSON.stringify(history, null, 2));
    } catch (error) {
        console.error('Ошибка при сохранении history.json:', error);
    }
}
const foundUserById = (id) => {
    return users.find( user => user.id == id)
}
function authenticate(req, res, next){
    if (req.session.isAuthenticated) {
        return next()
    }
    res.redirect('/')
}
import { ballons } from './ballons.js'
import { mattress } from './mattress.js'
import { fbort } from './fbort.js'
import axios from "axios"
import fs from 'fs'
const defaulProps = {
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
const calcs = {
    ballons,
    mattress,
    fbort
}
export class Calculator{
    constructor(){
        this.userprops = {}
        this.updateSelfcost()
        this.loadHistory()
    }
    async updateSelfcost(req = false, res = false){
        this.selfcost = req.body || await axios.get(process.env.SELFCOSTURL).then(res => res.data).catch(error => console.log(error))
        res && res.sendStatus(200)
    }
    calculate(req){
        const type = req.params.calc
        const userId = req.session.userId
        return calcs[type](this.getUserProps(userId,type),this.selfcost)
    }
    updateUserProps(req, res){
        const type = req.params.calc
        const userId = req.session.userId
        this.userprops[userId] ? false : this.userprops[userId] = {}
        this.userprops[userId][type] = req.body
        res.redirect(`/main/${req.params.calc}`)
    }
    getUserProps(userId, type){
        return this.userprops[userId]?.[type] || defaulProps[type]
    }
    async saveHistory(req = false, res, redir){
        if(req){
            const dataForSave = {
                initialData: this.getUserProps(req.session.userId, req.params.calc),
                calcs: this.calculate(req),
                markup: req.body.markup,
                comments: req.body.comments,
                meta: { author: req.session.username,
                        date: new Date()
                }
            }
            this.history[req.params.calc][++this.history.id] = dataForSave
        }
        try {
            await fs.promises.writeFile('./calcs/history.json', JSON.stringify(this.history, null, 2));
        }catch (error){
            console.error('Ошибка при сохранении history.json:', error);
        }
        req && res.redirect(`/main/${req.params.calc}`)
    }
    async loadHistory(){
        try{
            this.history = await fs.promises.readFile('./calcs/history.json', 'utf8').then(JSON.parse)
        }catch (error){
            console.error('Ошибка при загрузке history.json:', error)
        }
    }
    async deleteHistory(req){
        delete this.history[req.params.calc][req.body.id]
        await this.saveHistory()
    }
    async editHistory(req, res){
        this.history[req.params.calc][req.body.id].comments = req.body.comments
        this.history[req.params.calc][req.body.id].markup = req.body.markup
        await this.saveHistory()
        res.redirect(`/main/${req.params.calc}`)
    }
    renderCalcs = (req,res, sideMenu) =>{
        const commonArgs = {
            img: `../img/${req.params.calc}.png`,
            sideMenu,
            current: req.params.calc,
            last: this.getUserProps(req.session.userId, req.params.calc),
            history: this.history[req.params.calc]
        }
        res.render(`calcs/${req.params.calc}`, {...commonArgs, ...{result: this.calculate(req, res)}});
    }
}
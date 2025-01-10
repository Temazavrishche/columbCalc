import { ballons } from './ballons.js'
import { mattress } from './mattress.js'
import { fbort } from './fbort.js'
import axios from "axios"
import { History, UserProps } from '../db/db.js'
import logger from '../logger.js'
import { redisClient } from '../app.js'
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
        this.updateSelfcost()
    }
    async updateSelfcost(req = false, res = false){
        this.selfcost = req.body || await axios.get(process.env.SELFCOSTURL).then(res => res.data).catch(error => console.log(error))
        console.log('selfcost loaded')
        res && res.sendStatus(200)
    }
    async calculate(req){
        const type = req.params.calc
        return calcs[type](await this.getUserProps(req.session.username,type),this.selfcost)
    }
    async updateUserProps(req, res){
        try{
            await redisClient.setEx(`${req.session.username}:${req.params.calc}`, 3600, JSON.stringify(req.body));
            await UserProps.upsert({
                type: req.params.calc,
                user: req.session.username,
                props: req.body,
              })
        }catch (error){
            console.error('Ошибка при сохранении в бд UserProps: ', error)
            logger.error(`Error: ${error}`)
        }
        res.redirect(`/main/${req.params.calc}`)
    }
    async getUserProps(user, type) {
        try {
            const data = await redisClient.get(`${user}:${type}`);
            
            if (data !== null) {
                return JSON.parse(data)
            } else {
                const userProps = await UserProps.findOne({
                    where: { user, type }
                })
                if(userProps){
                    await redisClient.setEx(`${user}:${type}`, 3600, JSON.stringify(userProps.props))
                    return userProps.props
                }else return defaulProps[type]
            }
        } catch (error) {
            console.error('Ошибка при получении UserProps:', error);
            logger.error(`Error: ${error}`);
            return defaulProps[type];
        }
    }
    
    
    async saveHistory(req, res){
        try {
            await History.create({
                type: req.params.calc,
                calcs: await this.calculate(req),
                markup: req.body.markup,
                comments: req.body.comments,
                author: req.session.username
            })
        }catch (error){
            console.error('Ошибка при сохранении в бд History: ', error)
            logger.error(`Error: ${error}`)
        }
        res.redirect(`/main/${req.params.calc}`)
    }
    async deleteHistory(req, res){
        try{
            await History.destroy({
                where: {
                    id: req.body.id
                }
            })
            res.sendStatus(200)
        }catch (error){
            console.error('Ошибка при удалении записи в бд History: ', error)
            logger.error(`Error: ${error}`)
            res.redirect(`/main/${req.params.calc}`)
        }
    }
    async editHistory(req, res){
        try{
            await History.update({
                comments: req.body.comments,
                markup: req.body.markup
                },{
                    where: {
                        id: req.body.id
                    }
                }
            )
            res.redirect(`/main/${req.params.calc}`)
        }catch(error){
            console.error('Ошибка при обновлении записи в бд History: ', error)
            logger.error(`Error: ${error}`)
            res.redirect(`/main/${req.params.calc}`)
        }
    }
    async renderCalcs(req, res, sideMenu){
        let allHistory
        try{
            const history = await History.findAll({
                where: {
                    type: req.params.calc
                }
            })
            allHistory = history.map(item => item.toJSON())
        }catch{
            allHistory = []
        }
        const commonArgs = {
            img: `../img/${req.params.calc}.png`,
            sideMenu,
            current: req.params.calc,
            last: await this.getUserProps(req.session.username, req.params.calc),
            history: allHistory
        }
        res.render(`calcs/${req.params.calc}`, {...commonArgs, ...{result: await this.calculate(req)}});
    }
}
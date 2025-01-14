import axios from "axios";
import { Product } from "../db/db.js"
import logger from '../logger.js'

const skladHeaders = { 
    headers: {
    Authorization : `Basic ${process.env.SKLADTOKEN}`
}}

export class OzonController{
    /*async hookUpdateStockOzon(req, res){
        try{
            const obj = {}
            const changedProducts = await axios.get(req.body.reportUrl + '&stockType=quantity', skladHeaders)
            const data = await Product.findAll({
                where: {
                    skladAssortmentId: changedProducts.data.map(el => {
                        obj[el.assortmentId] = {stock: el.quantity}
                        return el.assortmentId
                    })
                },
            })
            if(!data.length) {
                res.sendStatus(500)
                return
            }
            data.forEach(el => {
                obj[el.skladAssortmentId] = Object.assign(obj[el.skladAssortmentId], el.toJSON())
                delete obj[el.skladAssortmentId].skladAssortmentId
            })
            updateOzonHeap = updateOzonHeap.concat(Object.values(data))
            doUpdateStockOzon()
            res.sendStatus(200)
        }catch(error){
            console.error('Ошибка при получении ozon:', error);
            logger.error(`Error: ${error}`);
            res.sendStatus(500)
        }
    }*/
    async renderOzon(req, res, sideMenu){
        try{
            const data = await Product.findAll()
            res.render('layouts/ozon', {sideMenu, products: data.map(el => el.toJSON())})
        }
        catch(error){
            console.error('Ошибка при получении ozon:', error);
            logger.error(`Error: ${error}`);
            res.send({
                error: error
            })
        }
    }
    async downAll(req, res){
        try{
            const data = await Product.findAll({attributes: ['offer_id', 'product_id', 'quant_size', 'warehouse_id']})
            const result = data.map(el => {
                const temp = el.toJSON()
                temp.stock = 0
                return temp
            })
            updateOzonHeap = updateOzonHeap.concat(result)
            doUpdateStockOzon()
            res.sendStatus(200)
        }
        catch(error){
            console.error('Ошибка при обновлении всех товаров', error);
            logger.error(`Error: ${error}`);
            res.sendStatus(500)
        }
    }
    async updateAllProducts(req, res){
        try{
            const dataForBundle = await Product.findAll({attributes: ['offer_id', 'product_id', 'quant_size', 'warehouse_id'], where: {bundle: true, update: true}})
            const temp = {}
            dataForBundle.forEach(el => {
                temp[el.offer_id] = el.toJSON()
                temp[el.offer_id].stock = {}
            })
            const dataForBundleFromSklad = await doSkladReq(`https://api.moysklad.ru/api/remap/1.2/entity/bundle?expand=components.assortment&limit=100&filter=code=${dataForBundle.map(el => el.offer_id).join(';code=')}`, 'get')
            const promises = await Promise.all(dataForBundleFromSklad.rows.map(product => doSkladReq(`https://api.moysklad.ru/api/remap/1.2/entity/assortment/?filter=code=${product.components.rows.map(el => {
                temp[product.code].stock[el.assortment.code] = el.quantity
                return el.assortment.code
            }).join(';code=')}`, 'get')))
            const skladQuantity = {}
            promises.forEach(el => el.rows.forEach(el => skladQuantity[el.code] = el.quantity))
            for(const key in temp){
                let min = Infinity
                for(const key2 in temp[key].stock){
                    min = Math.floor(Math.min(min, skladQuantity[key2] / temp[key].stock[key2]))
                }
                temp[key].stock = min < 0 ? 0 : min
            }

            const data = await Product.findAll({attributes: ['offer_id', 'product_id', 'quant_size', 'warehouse_id'], where: {bundle: false, update: true}})
            data.forEach(el => {
                temp[el.offer_id] = el.toJSON()
                temp[el.offer_id].stock = {}
            })
            const dataFromSklad = []
            for(let i = 0; i < data.length; i += 50){
                dataFromSklad.push(doSkladReq(`https://api.moysklad.ru/api/remap/1.2/entity/assortment/?filter=code=${data.slice(i, i + 50).map(el => {
                    temp[el.offer_id] = el.toJSON()
                    return el.offer_id
                }).join(';code=')}`, 'get'))
            }
            const promises2 = await Promise.all(dataFromSklad)
            promises2.forEach(el => {
                el.rows.forEach(el => {
                    temp[el.code].stock = el.quantity < 0 ? 0 : el.quantity
                })
            })
            updateOzonHeap = updateOzonHeap.concat(Object.values(temp))
            doUpdateStockOzon()
            res && res.sendStatus(200)
        }catch(error){
            console.error('Ошибка при обновлении ozon:', error);
            logger.error(`Error: ${error}`);
            res.sendStatus(500)
        }
    }
    async deleteProduct(req, res){
        try{
            await Product.destroy({
                where: {
                    offer_id: req.body.offer_id
                }
            })
            res.redirect('/ozon')
        }catch(error){
            console.error('Ошибка при удалении ozon:', error);
            logger.error(`Error: ${error}`);
            res.sendStatus(500)
        }
    }
    async addProduct(req, res){
        try{
            const skladData = await axios.get(`https://api.moysklad.ru/api/remap/1.2/entity/assortment?filter=code=${req.body.offer_id}`, skladHeaders)
            if(skladData.data.rows.length == 0){
                res.send('Ошибка при добавлении товара')
                return 
            }
            await Product.create({
                offer_id: req.body.offer_id,
                product_id: req.body.product_id,
                skladAssortmentId: skladData.data.rows[0].id,
                bundle: skladData.data.rows[0].meta.type == 'bundle' ? true : false
            })
            res.redirect('/ozon')
        }catch(error){
            console.error('Ошибка при добавлении ozon:', error);
            logger.error(`Error: ${error}`);
            res.status(500).redirect('/ozon')
        }
    }
    async ozonHook(req, res){
        const mapping = {
            'TYPE_PING': type_ping,
            'TYPE_NEW_POSTING': new_or_cancelled,
            'TYPE_POSTING_CANCELLED': new_or_cancelled
        }
        await mapping[req.body.message_type](req,res)
    }
    async syncProductsFromOzon(req, res){
        try{
            const allProductsOnOzon = await axios.post('https://api-seller.ozon.ru/v3/product/list',{
                "filter": {
                    "offer_id": [],
                    "product_id": [],
                    "visibility": "ALL"
                },
                "last_id": "",
                "limit": 1000
            }, ozonHeaders)
            const obj = {}
            allProductsOnOzon.data.result.items.forEach(el => obj[el.offer_id] = {offer_id: el.offer_id, product_id: el.product_id})
            for(let i = 0; i < allProductsOnOzon.data.result.items.length; i += 50){
                const response = await axios.get(`https://api.moysklad.ru/api/remap/1.2/entity/assortment?filter=code=${allProductsOnOzon.data.result.items.map(el => el.offer_id).slice(i, i + 50).join(';code=')}`,skladHeaders)
                response.data.rows.forEach(el => {
                    obj[el.code].skladAssortmentId = el.id
                    obj[el.code].type = el.meta.type
                })
            }
            const errors = []
            Object.values(obj).forEach(async el => {
                try{
                    await Product.create({
                        offer_id: el.offer_id,
                        product_id: el.product_id,
                        skladAssortmentId: el.skladAssortmentId,
                        bundle: el.type == 'bundle' ? true : false
                    })
                }catch(error){
                    errors.push(error)
                }
            })
            res.status(200).send({
                errors: errors
            })
        }catch(error){
            console.error('Ошибка при добавлении ozon:', error);
            logger.error(`Error: ${error}`);
            res.sendStatus(500)
        }
    }
    async toggleUpdate(req, res){
        try{
            const test = await Product.update({
                update: req.body.update === 'true' ? false : true
            },{
                where: {
                    offer_id: req.body.offer_id
                }
            })
            console.log(test)
            res.redirect('/ozon')
        }
        catch(error){
            console.error('Ошибка при обновлении всех товаров', error);
            logger.error(`Error: ${error}`);
            res.sendStatus(500)
        }
    }
}

const type_ping = (req, res) => {
    res.status(200).send({
        "version": "0.1",
        "name": "columbAPI",
        "time": new Date()
    })
}

const new_or_cancelled = async (req, res) => {
    const newOrders = req.body.products
    try{
        const args = {
            "organization": {
                "meta": {
                    "href": "https://api.moysklad.ru/api/remap/1.2/entity/organization/77e3a9af-4dfb-11e8-9107-5048002bbbf7",
                    "type": "organization",
                    "mediaType": "application/json"
              }
            },
            "store": {
                "meta": {
                    "href": "https://api.moysklad.ru/api/remap/1.2/entity/store/77e4c035-4dfb-11e8-9107-5048002bbbf9",
                    "type": "store",
                    "mediaType": "application/json"
                }
            },
            "positions": await Promise.all(newOrders.map(async el => {
                const data = await Product.findOne({
                    attributes: ['offer_id'],
                    where: {
                        product_id: el.sku
                    }
                })
                const posInfo = await doSkladReq(`https://api.moysklad.ru/api/remap/1.2/entity/assortment?filter=code=${data.offer_id}`, 'get').then(el => el.rows[0])
                if(!posInfo.components)
                    return {
                        quantity: el.quantity,
                        assortment: {
                        meta: posInfo.meta,
                        },
                        price: posInfo.salePrices[0].value
                    }
                else{
                    const componentsInfo = await doSkladReq(posInfo.components.meta.href, 'get')
                    return await Promise.all(componentsInfo.data.rows.map(async component => {
                        const metaInfo = await doSkladReq(component.assortment.meta.href, 'get')
                        return {
                            quantity: component.quantity * el.quantity,
                            assortment: {
                                meta: metaInfo.data.meta
                            },
                            price: metaInfo.data.salePrices[0].value
                        }
                    }))
                }
            })).then(el => el.flat()),
            "description": `This document created automatically with API, it belongs to order with posting number ${req.body.posting_number}`
        }
        if(req.body.message_type == 'TYPE_NEW_POSTING'){
            args.agent = {
                "meta": {
                    "href": "https://api.moysklad.ru/api/remap/1.2/entity/counterparty/9893428c-d5d3-11ec-0a80-0c7b000bdebf",
                    "type": "counterparty",
                    "mediaType": "application/json"
                },
            },
            args.state = {
                "meta": {
                    "href" : "https://api.moysklad.ru/api/remap/1.2/entity/demand/metadata/states/261e245d-e9c1-11e9-0a80-01b40007536e",
                    "type" : "state",
                    "mediaType" : "application/json"
                }
            }
            args.salesChannel = {
                "meta": {
                    "href" : "https://api.moysklad.ru/api/remap/1.2/entity/saleschannel/b0a15997-de45-11ec-0a80-02f600145265",
                    "type" : "saleschannel",
                    "mediaType" : "application/json",
                }
            }
            const response = await doSkladReq(`https://api.moysklad.ru/api/remap/1.2/entity/demand`, 'post', args)
        }else{
            if(req.body.warehouse_id != 23524151071000){
                res.status(200).send({result: true})
                return
            }
            args.state = {
                "meta": {
                    "href" : "https://api.moysklad.ru/api/remap/1.2/entity/enter/metadata/states/138e167d-682f-11ee-0a80-054f00100492",
                    "metadataHref" : "https://api.moysklad.ru/api/remap/1.2/entity/enter/metadata",
                    "type" : "state",
                    "mediaType" : "application/json"
                  }
            }
            const response = await doSkladReq(`https://api.moysklad.ru/api/remap/1.2/entity/enter`, 'post', args)
        }
        res.status(200).send({result: true})
    }catch(error){
        console.error('Ошибка при создании документа в MoySklad:', error);
        logger.error(`Error: ${error}`);
        res.status(500).send({
            "error": {
               "code": "ERROR",
               "message": "ошибка",
               "details": null
            }
         })
    }
}
const ozonHeaders = {
    headers: {
        "Client-Id": process.env.OZONCLIENTID,
        "Api-Key": process.env.OZONAPIKEY
    }
}

let canUpdateStock = true
let updateOzonHeap = []
const doUpdateStockOzon = async () => {
    while (!canUpdateStock) {
        await sleep(1000)
    }
    if(updateOzonHeap.length < 1) return
    const data = updateOzonHeap.splice(0, 90)
    canUpdateStock = false
    setTimeout(() => canUpdateStock = true, 30_000)
    const response = await axios.post(`https://api-seller.ozon.ru/v2/products/stocks`, {
        stocks: data
    }, ozonHeaders)
    if(response.data.message == 'TOO_MANY_REQUESTS'){
        updateOzonHeap = updateOzonHeap.concat(data)
        doUpdateStockOzon()
    }
    response.data.result.forEach(el => {
        !el.updated &&updateOzonHeap.push({warehouse_id: el.warehouse_id, product_id: el.product_id, quant_size: el.quant_size, offer_id: el.offer_id, stock: data.find(dataEl => dataEl.offer_id == el.offer_id).stock})
    })
    if(updateOzonHeap.length > 0) doUpdateStockOzon()
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
function skladCounter() {
    skladReqCounter++
    setTimeout(() => skladReqCounter--, 3000)
}


let skladReqCounter = 0
const skladReqQueue = new Set()

async function doSkladReq(url, type, data){
    const canMakeRequest = () => {
        if (skladReqQueue.size >= 5) return false
        if (skladReqCounter >= 40) return false
        return true;
    }
    while (!canMakeRequest()) {
        await sleep(300)
    }

    skladCounter()
    const options = data ? [url, data, skladHeaders] : [url, skladHeaders]
    const response = axios[type](...options)
        .then(res => res.data)
        .finally(() => {
            skladReqQueue.delete(response)
        });
    
    skladReqQueue.add(response)
    
    return response;
};
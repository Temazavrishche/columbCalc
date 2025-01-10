import axios from "axios";
import { Product } from "../db/db.js"
import logger from '../logger.js'

const skladHeaders = { 
    headers: {
    Authorization : `Basic ${process.env.SKLADTOKEN}`
}}

export class OzonController{
    async hookUpdateStockOzon(req, res){
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
            await doUpdateOzon(Object.values(obj))
            res.sendStatus(200)
        }catch(error){
            console.error('Ошибка при получении ozon:', error);
            logger.error(`Error: ${error}`);
            res.sendStatus(500)
        }
    }
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
            await doUpdateOzon(result)
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
            const data = await Product.findAll({attributes: ['offer_id', 'product_id', 'quant_size', 'warehouse_id', 'skladAssortmentId']})
            const skladReport = await axios.get('https://api.moysklad.ru/api/remap/1.2/report/stock/all', skladHeaders)
            const map = new Map()
            skladReport.data.rows.forEach(el => map.set(el.code, el.quantity < 0 ? 0 : el.quantity)) //Иногда количество может быть отрицательным если резерв больше стока
            const result = await Promise.all(data.map(async el => {
                const temp = el.toJSON()
                if(map.get(temp.offer_id))
                    temp.stock = map.get(temp.offer_id)
                else { //Если в отчете нет товара, то это бандл, его нужно считать вручную по компонентам
                    const quantityInBundle = {}
                    const assortmentQuantity = await axios.get(`https://api.moysklad.ru/api/remap/1.2/entity/bundle/${el.skladAssortmentId}/components`,skladHeaders)
                    .then(async el => {
                        return await axios.get(`https://api.moysklad.ru/api/remap/1.2/report/stock/all/current?stockType=quantity&include=zeroLines&filter=assortmentId=${el.data.rows.map(assortment => {
                            const id = assortment.assortment.meta.href.match(/\/([a-f0-9\-]{36})$/)?.[1]
                            quantityInBundle[id] = assortment.quantity
                            return id
                        }).join(',')}`, skladHeaders)
                    })
                    temp.stock = Math.floor(Math.min(...assortmentQuantity.data.map(el => el.quantity / quantityInBundle[el.assortmentId])))
                }
                return temp
            }))
            await doUpdateOzon(result)
            res.sendStatus(200)
        }
        catch(error){
            console.error('Ошибка при обновлении всех товаров', error);
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
                skladAssortmentId: skladData.data.rows[0].id
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
                const posInfo = await axios.get(`https://api.moysklad.ru/api/remap/1.2/entity/assortment?filter=code=${data.offer_id}`, skladHeaders).then(el => el.data.rows[0])
                if(!posInfo.components)
                    return {
                        quantity: el.quantity,
                        assortment: {
                        meta: posInfo.meta,
                        },
                        price: posInfo.salePrices[0].value
                    }
                else{
                    const componentsInfo = await axios.get(posInfo.components.meta.href, skladHeaders)
                    return await Promise.all(componentsInfo.data.rows.map(async component => {
                        const metaInfo = await axios.get(component.assortment.meta.href, skladHeaders)
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
            const response = await axios.post(`https://api.moysklad.ru/api/remap/1.2/entity/demand`, args, skladHeaders)
        }else{
            args.state = {
                "meta": {
                    "href" : "https://api.moysklad.ru/api/remap/1.2/entity/enter/metadata/states/138e167d-682f-11ee-0a80-054f00100492",
                    "metadataHref" : "https://api.moysklad.ru/api/remap/1.2/entity/enter/metadata",
                    "type" : "state",
                    "mediaType" : "application/json"
                  }
            }
            const response = await axios.post(`https://api.moysklad.ru/api/remap/1.2/entity/enter`, args, skladHeaders)
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

const doUpdateOzon = async (data) => {
    const ozonUrl = `https://api-seller.ozon.ru/v2/products/stocks`
    for(let i = 0; i < data.length; i += 100){
        const response = await axios.post(
            ozonUrl,
            {
                stocks: data.slice(i, i + 100),
            },
            {
                headers: {
                    "Client-Id": process.env.OZONCLIENTID,
                    "Api-Key": process.env.OZONAPIKEY
                }
            }
        )
        response.data.result.find(el => {
            if(el.errors.length > 0)
                throw new Error()
        })
    }
}
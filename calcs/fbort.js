export const fbort = (data, selfcost) => {
    for(const item in data){
        data[item] = Number(data[item])
    }

    const oporka1 = ((data.straightLength + data.lengthWithRadius) * 1.07) * 30
    const oporka2 = (2 * Math.PI * (data.diameter / 2)) * 30
    const gluingArea = (oporka1 * 6 +  oporka2 * 3) * 1.2

    const arcWidth = data.fromCenterToTurn - data.fromCenterToEnd //Ширина загиба
    const onePartWidth = ((data.diameter / 2) * Math.PI * 2) / 2  + 15//Ширина одной детали по прямой
    const fabricConsumption =  (arcWidth + onePartWidth) * 2 < data.rollWidth ? (data.straightLength + 30 + ((data.lengthWithRadius + 50)  * 2)) * data.rollWidth : ((data.straightLength + 30 + data.lengthWithRadius + 50) * 2) * data.rollWidth
    const allArea = fabricConsumption + gluingArea + 1000000 * data.addPartitions

    const gluePerm2 = 0.18 //Расход клея на 1 м2, кг
    const glueConsumption = gluingArea * gluePerm2 * 0.8
    const acetonConsumption = gluingArea * gluePerm2 * 0.4
    const hardenerConsumption = gluingArea * gluePerm2 * 0.03

    const cuttingTime = 150
    const buildTime = 240
    const result = {
        "Материалы": {
            [`Ткань ${data.fabric}г/м2`]: {cost: selfcost[`ткань ${data.fabric}г/м2`], count: allArea / 1000000},
            "Клапан": {cost: selfcost[`клапан`], count: data.addPartitions},
            "Переходник": {cost: selfcost[`переходник`], count: 1},
            "Клей, кг": {cost: selfcost[`клей, кг`], count: glueConsumption / 1000000},
            "Отвердитель, л": {cost: selfcost[`отвердитель, л`], count: hardenerConsumption / 1000000},
            "Ацетон, л": {cost: selfcost[`ацетон, л`], count: acetonConsumption / 1000000},
            "Кисть, шт": {cost: selfcost[`кисть, шт`], count: 0.5},
            "Скотч, рулон": {cost: selfcost[`скотч, рулон`], count: 0.5}
        },
        "Раскрой": {
            "Стоимость раскроя": {cost: (selfcost[`Закройщик, цена без налогов, мес`] / 22 / 6) / 60 * cuttingTime, count: cuttingTime}
        },
        "Сборка": {
            "Стоимость сборки": {cost: (selfcost[`Сборщик, цена без налогов, мес`] / 22 / 8) / 60 * buildTime, count: buildTime}
        }
    };
    
    let price = 0
    for(const category in result){
        for(const items in result[category]){
            const {cost, count} = result[category][items]
                if(category == "Раскрой" || category == "Сборка")
                    price += cost  
                else
                    price += cost * count
        }
    }
    result.price = price
    return result
}
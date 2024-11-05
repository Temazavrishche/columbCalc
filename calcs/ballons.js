export const ballons = (data, selfcost) => {
    for(const item in data){
        item !== "reinforcement" && item !== "mounting" ? data[item] = Number(data[item]) : false
    }
    const splice = 30 //Склейка
    const circumference = data.diameter * Math.PI // Длина окружности

    const cutWidth = circumference <= data.rollWidth - 630 ? circumference + 15 : data.rollWidth//

    const oporka = (data.length * 2 * 30) + circumference * 30 + 90000//Длина * 2 шт * ширина полоски  + максимальная форма
    const partionWallArea = (((circumference + 20) / 2) ** 2) * data.partitions
    const fabricConsumption = (cutWidth * (data.length + splice)) + (data.diameter ** 2) * 2 * 1.1 // + максимальная форма
    const gluePerm2 = 0.18 //Расход клея на 1 м2, кг
    const gluingArea = (oporka * 2 + data.length * 2 * 30) / 1000000
    const reinfMap = {
        1: 500,
        2: 1000,
        3: 1000,
        4: 1000,
        5: 0,
        6: 500,
    }
    const glueConsumption = gluingArea * gluePerm2 * 0.8
    const acetonConsumption = gluingArea * gluePerm2 * 0.4
    const hardenerConsumption = gluingArea * gluePerm2 * 0.03

    const buildTime = (data.length / 1000) * 40 + 60 * data.partitions // 40 - время сборки 1 метра баллона, 60 время вклейки 1 перегородки
    const cuttingTime = (data.length / 1000) * 17 //17 - время раскроя 1 метра баллона

    const result = {
        "Материалы": {
            [`Ткань ${data.fabric}г/м2`]: {cost: selfcost[`ткань ${data.fabric}г/м2`], count: (fabricConsumption + oporka) / 1000000},
            "Ткань 650г/м2 для перегородок": {cost: selfcost[`ткань 650г/м2`], count: partionWallArea / 1000000},
            "Клапан": {cost: selfcost[`клапан`], count: data.partitions + 1},
            "Переходник": {cost: selfcost[`переходник`], count: 1},
            "Клей, кг": {cost: selfcost[`клей, кг`], count: glueConsumption},
            "Отвердитель, л": {cost: selfcost[`отвердитель, л`], count: hardenerConsumption},
            "Ацетон, л": {cost: selfcost[`ацетон, л`], count: acetonConsumption},
            "Кисть, шт": {cost: selfcost[`кисть, шт`], count: 0.5},
            "Законцовки усеченные": {cost: selfcost[`законцовки усеченные`], count: 1},
            "Логотип резиновый 12*10": {cost: selfcost[`логотип резиновый 12*10`], count: 1},
            "Скотч, рулон": {cost: selfcost[`скотч, рулон`], count: 0.5}
        },
        "Раскрой": {
            "Стоимость раскроя": {cost: (selfcost[`Закройщик, цена без налогов, мес`] / 22 / 6) / 60 * cuttingTime, count: cuttingTime}
        },
        "Сборка": {
            "Стоимость сборки": {cost: (selfcost[`Сборщик, цена без налогов, мес`] / 22 / 8) / 60 * buildTime, count: buildTime}
        },
    }
    if(data.reinforcement != "none" && data.reinforcement != "fabric"){
        result["Дополнительно"] = {}
        result["Дополнительно"][`Усиление привальным брусом ${data.reinforcement} см`] = {cost: selfcost[`Усиление 1 м.п, ширина ${data.reinforcement}см`], count: ((data.length - reinfMap[data.shape]) / 1000)}
    }else if(data.reinforcement == "fabric"){

    }
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
export const mattress = (data, selfcost) => {
    for(const item in data){
        data[item] = Number(data[item])
    }
    const averagCellCompression = 13;//Среднее сжатие ячейки
    const splice = 30;//Склейка с 2 сторон по 15 мм
    const sideBlowing = linearInterpolation(data.height,100,20,230,40) * 2//Боковой выдув
    const verticalBlowing = linearInterpolation(data.height,100,15,230,30) * 2//Вертикальный выдув
    const cells = closestNumber(data.width,data.height,sideBlowing)//Количество ячеек ближайшее к заданной ширине
    const factWidth = data.width - sideBlowing + splice + cells * averagCellCompression;//Ширина раскроя
    const factLenght = data.length - sideBlowing + splice;//Длина раскроя
    const heightOfPartionWall = data.height - verticalBlowing + splice - linearInterpolation(data.height,100,0,230,30)//Высота перегородки
    const coef = 1.1
    const cosoyCoef = 1.7
    const gluePerm2 = 0.18 //Расход клея на 1 м2, кг
    const rectangleArea = ((factWidth * factLenght) * 2)/ 1000000
    const partionWallArea = (((factLenght - (splice)) * heightOfPartionWall) * cells - 1)/ 1000000
    const oporkaArea = (((factLenght - (splice)) * 30) * ((cells - 1) * 2))/ 1000000
    const sideWallStraight = ((factLenght * heightOfPartionWall) * 2)/ 1000000
    const sideWall = (((factWidth + splice) * heightOfPartionWall) * 2)/ 1000000

    const allArea = (((rectangleArea + partionWallArea + oporkaArea + sideWallStraight) * coef) + (sideWall * cosoyCoef))
    const buildTime = (cells - 1) * 50
    const cuttingTime = data.length * data.width / 1000000 * 45

    const gluingArea = (((((factLenght + factWidth) * 2) * 15) * 4) / 1000000) + ((oporkaArea * 3) * 1.07) + (((heightOfPartionWall * 30) * 4) / 1000000)

    const glueConsumption = gluingArea * gluePerm2 * 0.8
    const acetonConsumption = gluingArea * gluePerm2 * 0.4
    const hardenerConsumption = gluingArea * gluePerm2 * 0.03


    const result = {
        "Материалы": {
            [`Ткань ${data.fabric}г/м2`]: {cost: selfcost[`ткань ${data.fabric}г/м2`], count: allArea},
            "Логотип простой 9*6": {cost: selfcost[`логотип простой 9*6`], count: 1},
            "Клапан": {cost: selfcost[`клапан`], count: 1},
            "Переходник": {cost: selfcost[`переходник`], count: 1},
            "Клей, кг": {cost: selfcost[`клей, кг`], count: glueConsumption},
            "Отвердитель, л": {cost: selfcost[`отвердитель, л`], count: hardenerConsumption},
            "Ацетон, л": {cost: selfcost[`ацетон, л`], count: acetonConsumption},
            "Кисть, шт": {cost: selfcost[`кисть, шт`], count: 0.5},
            "Скотч, рулон": {cost: selfcost[`скотч, рулон`], count: 0.5}
        },
        "Раскрой": {
            "Стоимость раскроя": {cost: (selfcost[`Закройщик, цена без налогов, мес`] / 22 / 6) / 60 * cuttingTime, count: cuttingTime}
        },
        "Сборка": {
            "Стоимость сборки": {cost: (selfcost[`Сборщик, цена без налогов, мес`] / 22 / 8) / 60 * buildTime, count: buildTime}
        }
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

function linearInterpolation(x, x1, y1, x2, y2) {
    x > 230 ? x = 230 : false
    return y1 + ((y2 - y1) / (x2 - x1)) * (x - x1)
}
function closestNumber(width,height,sideBlowing){
  const partWallStep = linearInterpolation(height,100,89,230,160)
  const v1 = Math.floor(width / partWallStep)
  const v2 = Math.ceil(width / partWallStep)
  const diff1 = width - (v1 * partWallStep + sideBlowing)
  const diff2 = width - (v2 * partWallStep + sideBlowing)

  return Math.abs(diff1) < Math.abs(diff2) ? v1 : v2
}
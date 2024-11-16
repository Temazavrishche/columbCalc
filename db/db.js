import { Sequelize, DataTypes } from "sequelize"

const sequelize = new Sequelize('columb', 'postgres', process.env.DBPASSWORD,{
    dialect: 'postgres',
    host: 'localhost',
    logging: false
})

export const User = sequelize.define('User',{
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    username: {
        type: DataTypes.STRING(25),
        unique: true,
    },
    password: {
        type: DataTypes.STRING(100)
    },
    role: {
        type: DataTypes.STRING(25)
    }
},{
    tableName: 'Users',
    timestamps: false
})

export const History = sequelize.define("History", {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    type: {
      type: DataTypes.STRING(25),
    },
    calcs: {
      type: DataTypes.JSON,
    },
    markup: {
      type: DataTypes.DECIMAL(10, 2),
    },
    comments: {
      type: DataTypes.TEXT,
    },
    author: {
      type: DataTypes.STRING(25),
      onUpdate: "CASCADE",
    },
  }, {
    tableName: "Histories",
  });
  

export const UserProps = sequelize.define("UserProps", {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    user: {
      type: DataTypes.STRING(25),
      references: {
        model: User,
        key: "username",
      },
      onDelete: "CASCADE",
    },
    type: {
      type: DataTypes.STRING(25),
    },
    props: {
      type: DataTypes.JSON,
    },
  }, {
    tableName: "UserProps",
    indexes: [
      {
        unique: true,
        fields: ["user", "type"],
      },
    ],
  });
  
await sequelize.sync()
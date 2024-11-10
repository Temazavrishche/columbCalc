import fs from 'fs'
import bcrypt from 'bcrypt'

export class AuthController {
    constructor(){
        this.loadUsers()
    }
    async login(req, res) {
        const { password, username } = req.body
        const user = this.users.find(user => user.username === username)
        
        if (!user) return res.render('layouts/index', { username, error: true })

        if (await bcrypt.compare(password, user.password)) {
            req.session.isAuthenticated = true
            req.session.userRole = user.role
            req.session.userId = user.id
            req.session.username = username
            return res.redirect('/main');
        }
        res.render('layouts/index', { username, error: true })
    }
    authenticate(req, res, next){
        if (req.session.isAuthenticated) return next()
        res.redirect('/')
    }
    async loadUsers(){
        try{
            this.users =  await fs.promises.readFile('./auth/users.json', 'utf8').then(JSON.parse)
        }
        catch(error){
            console.error('Ошибка при загрузке users.json:', error)
        }
    }
}
import { User } from '../db/db.js'
import bcrypt from 'bcrypt'

export class AuthController {
    async login(req, res) {
        const { password, username } = req.body
        const user = await User.findOne({
            where: {
                username: username
            }
        })
        
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
}
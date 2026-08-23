const express = require('express');
const router = express.Router();

// Login page
router.get('/login', (req, res) => {
    if (req.session.user) {
        return res.redirect('/admin');
    }
    res.render('admin/login', { title: 'Admin Login' });
});

// Login process
router.post('/login', (req, res) => {
    const { username, password } = req.body;

    if (username === process.env.ADMIN_USERNAME && password === process.env.ADMIN_PASSWORD) {
        req.session.user = { username };
        req.flash('success_msg', 'Login berhasil!');
        res.redirect('/admin');
    } else {
        req.flash('error_msg', 'Username atau password salah');
        res.redirect('/auth/login');
    }
});

// Logout
router.get('/logout', (req, res) => {
    req.session.destroy(() => {
        res.redirect('/');
    });
});

module.exports = router;

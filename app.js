// ============================================
// FITBOOK - ПРИЛОЖЕНИЕ ДЛЯ ЗАПИСИ НА ТРЕНИРОВКИ
// ============================================

// КОНФИГУРАЦИЯ FIREBASE
const firebaseConfig = {
    apiKey: "AIzaSyD5gplXXpP69H0f0WDQehy4jLOOTnw2rZQ",
    authDomain: "fysm-2d26a.firebaseapp.com",
    projectId: "fysm-2d26a",
    storageBucket: "fysm-2d26a.firebasestorage.app",
    messagingSenderId: "1013209595020",
    appId: "1:1013209595020:web:5057a63c94dbf29aa4cfa9"
};

// ИНИЦИАЛИЗАЦИЯ FIREBASE
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

// ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ
let currentUser = null;
let userData = null;

// ============================================
// 🔐 АВТОРИЗАЦИЯ
// ============================================

// РЕГИСТРАЦИЯ
async function register(email, password, name) {
    try {
        const userCredential = await auth.createUserWithEmailAndPassword(email, password);
        const user = userCredential.user;
        
        await db.collection('users').doc(user.uid).set({
            name: name || email.split('@')[0],
            email: email,
            role: 'user',
            balance: 100,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        alert('✅ Регистрация успешна! Вам начислено 100 баллов.');
        return true;
    } catch (error) {
        alert('❌ Ошибка: ' + error.message);
        return false;
    }
}

// ВХОД
async function login(email, password) {
    try {
        await auth.signInWithEmailAndPassword(email, password);
        return true;
    } catch (error) {
        alert('❌ Ошибка входа: ' + error.message);
        return false;
    }
}

// ВЫХОД
async function logout() {
    if (confirm('Выйти из системы?')) {
        await auth.signOut();
    }
}

// ============================================
// 📱 ОСНОВНЫЕ ФУНКЦИИ
// ============================================

// ПЕРЕКЛЮЧЕНИЕ ЭКРАНОВ
function showScreen(screenName) {
    // Скрыть все экраны
    document.querySelectorAll('.screen').forEach(screen => {
        screen.classList.remove('active');
    });
    
    // Показать нужный экран
    const targetScreen = document.getElementById(screenName + 'Screen');
    if (targetScreen) {
        targetScreen.classList.add('active');
    }
    
    // Обновить активную кнопку в меню
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.screen === screenName) {
            btn.classList.add('active');
        }
    });
}

// ЗАГРУЗКА ДАННЫХ ПОЛЬЗОВАТЕЛЯ
async function loadUserData() {
    if (!currentUser) return;
    
    try {
        const userDoc = await db.collection('users').doc(currentUser.uid).get();
        if (userDoc.exists) {
            userData = userDoc.data();
            updateUI();
            
            // Загружаем дополнительные данные
            if (userData.role === 'user') {
                loadTrainings();
                loadTransactions();
            }
        }
    } catch (error) {
        console.error('Ошибка загрузки данных:', error);
    }
}

// ОБНОВЛЕНИЕ ИНТЕРФЕЙСА
function updateUI() {
    // Имя пользователя
    const userNameElement = document.getElementById('userName');
    if (userNameElement && userData) {
        userNameElement.textContent = userData.name || userData.email;
    }
    
    // Баланс
    const balanceElement = document.getElementById('balanceAmount');
    if (balanceElement && userData) {
        balanceElement.textContent = userData.balance || 0;
    }
    
    // Кнопка выхода
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.style.display = currentUser ? 'block' : 'none';
    }
    
    // Нижнее меню
    const bottomNav = document.querySelector('.bottom-nav');
    if (bottomNav) {
        bottomNav.style.display = currentUser ? 'flex' : 'none';
    }
    
    // Панель тренера
    const trainerNavBtn = document.getElementById('trainerNavBtn');
    const createTrainingBtn = document.getElementById('createTrainingBtn');
    const btnCreateTraining = document.getElementById('btnCreateTraining');
    
    if (userData && userData.role === 'trainer') {
        if (trainerNavBtn) trainerNavBtn.style.display = 'flex';
        if (createTrainingBtn) createTrainingBtn.style.display = 'block';
        if (btnCreateTraining) btnCreateTraining.style.display = 'block';
    } else {
        if (trainerNavBtn) trainerNavBtn.style.display = 'none';
        if (createTrainingBtn) createTrainingBtn.style.display = 'none';
        if (btnCreateTraining) btnCreateTraining.style.display = 'none';
    }
}

// ============================================
// 🏋️‍♂️ ТРЕНИРОВКИ
// ============================================

// ЗАГРУЗКА ТРЕНИРОВОК
async function loadTrainings() {
    try {
        const querySnapshot = await db.collection('trainings')
            .where('date', '>=', firebase.firestore.Timestamp.now())
            .orderBy('date')
            .limit(20)
            .get();
        
        const container = document.getElementById('trainingsList');
        if (!container) return;
        
        container.innerHTML = '';
        
        if (querySnapshot.empty) {
            container.innerHTML = '<p class="text-center mt-3">Нет предстоящих тренировок</p>';
            return;
        }
        
        querySnapshot.forEach(doc => {
            const training = doc.data();
            const date = training.date.toDate();
            
            const card = document.createElement('div');
            card.className = 'training-card';
            card.innerHTML = `
                <h3>${training.title || 'Без названия'}</h3>
                <div class="training-meta">
                    <span><i class="far fa-calendar"></i> ${date.toLocaleDateString()}</span>
                    <span><i class="far fa-clock"></i> ${date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                    <span><i class="fas fa-coins"></i> ${training.price || 0} баллов</span>
                </div>
                ${training.description ? `<p>${training.description}</p>` : ''}
                ${training.trainerName ? `<p><small>Тренер: ${training.trainerName}</small></p>` : ''}
                
                <div class="mt-2">
                    ${userData && userData.role === 'trainer' ? `
                        <button onclick="manageTraining('${doc.id}')" class="btn-secondary" style="width:100%;">
                            Управление
                        </button>
                    ` : `
                        <button onclick="registerForTraining('${doc.id}', ${training.price || 0})" 
                                class="btn-primary" style="width:100%;"
                                ${userData && userData.balance < (training.price || 0) ? 'disabled' : ''}>
                            Записаться
                        </button>
                    `}
                </div>
            `;
            
            container.appendChild(card);
        });
    } catch (error) {
        console.error('Ошибка загрузки тренировок:', error);
        document.getElementById('trainingsList').innerHTML = `
            <p class="text-center mt-3">Ошибка загрузки тренировок</p>
        `;
    }
}

// ЗАПИСЬ НА ТРЕНИРОВКУ
async function registerForTraining(trainingId, price) {
    if (!currentUser || !userData) {
        alert('❌ Сначала войдите в систему');
        return;
    }
    
    if (userData.balance < price) {
        alert(`❌ Недостаточно баллов! Нужно: ${price}, у вас: ${userData.balance}`);
        return;
    }
    
    if (!confirm(`Записаться на тренировку за ${price} баллов?`)) {
        return;
    }
    
    try {
        await db.runTransaction(async (transaction) => {
            // Проверяем баланс
            const userRef = db.collection('users').doc(currentUser.uid);
            const userDoc = await transaction.get(userRef);
            const currentBalance = userDoc.data().balance;
            
            if (currentBalance < price) {
                throw new Error('Недостаточно баллов');
            }
            
            // Проверяем, не записан ли уже
            const registrationsQuery = await db.collection('registrations')
                .where('userId', '==', currentUser.uid)
                .where('trainingId', '==', trainingId)
                .get();
            
            if (!registrationsQuery.empty) {
                throw new Error('Вы уже записаны на эту тренировку');
            }
            
            // Списываем баллы
            transaction.update(userRef, {
                balance: currentBalance - price
            });
            
            // Создаем запись о регистрации
            const regRef = db.collection('registrations').doc();
            transaction.set(regRef, {
                userId: currentUser.uid,
                trainingId: trainingId,
                willAttend: true,
                attended: false,
                charged: true,
                registeredAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            
            // Создаем транзакцию
            const transRef = db.collection('transactions').doc();
            transaction.set(transRef, {
                userId: currentUser.uid,
                trainingId: trainingId,
                amount: price,
                type: 'debit',
                description: 'Запись на тренировку',
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
        });
        
        alert('✅ Вы успешно записаны!');
        loadUserData(); // Обновляем баланс
        loadTrainings();
    } catch (error) {
        alert('❌ Ошибка: ' + error.message);
    }
}

// ============================================
// 👨‍🏫 ФУНКЦИИ ТРЕНЕРА
// ============================================

// СОЗДАНИЕ ТРЕНИРОВКИ
async function createTraining() {
    const title = document.getElementById('trainingTitle').value;
    const date = document.getElementById('trainingDate').value;
    const price = document.getElementById('trainingPrice').value;
    const max = document.getElementById('trainingMax').value;
    const desc = document.getElementById('trainingDesc').value;
    
    if (!title || !date || !price || !max) {
        alert('❌ Заполните все обязательные поля');
        return;
    }
    
    try {
        await db.collection('trainings').add({
            title: title,
            date: firebase.firestore.Timestamp.fromDate(new Date(date)),
            price: parseInt(price),
            maxParticipants: parseInt(max),
            description: desc,
            trainerId: currentUser.uid,
            trainerName: userData.name,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        alert('✅ Тренировка создана!');
        closeModal();
        loadTrainings();
    } catch (error) {
        alert('❌ Ошибка: ' + error.message);
    }
}

// ОТКРЫТИЕ МОДАЛКИ СОЗДАНИЯ ТРЕНИРОВКИ
function openTrainingModal() {
    document.getElementById('trainingModal').style.display = 'block';
    document.getElementById('modalOverlay').style.display = 'block';
    
    // Установить дату по умолчанию (завтра, 19:00)
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(19, 0, 0, 0);
    
    document.getElementById('trainingDate').value = tomorrow.toISOString().slice(0, 16);
}

// ЗАКРЫТИЕ МОДАЛКИ
function closeModal() {
    document.getElementById('trainingModal').style.display = 'none';
    document.getElementById('modalOverlay').style.display = 'none';
}

// ============================================
// 🎯 ИНИЦИАЛИЗАЦИЯ
// ============================================

// СЛУШАТЕЛЬ СОСТОЯНИЯ АВТОРИЗАЦИИ
auth.onAuthStateChanged(async (user) => {
    if (user) {
        currentUser = user;
        await loadUserData();
        
        // Показать главное приложение
        document.getElementById('loginScreen').classList.remove('active');
        showScreen('schedule');
    } else {
        currentUser = null;
        userData = null;
        
        // Показать экран входа
        document.getElementById('loginScreen').classList.add('active');
        document.querySelectorAll('.screen:not(#loginScreen)').forEach(screen => {
            screen.classList.remove('active');
        });
        document.querySelector('.bottom-nav').style.display = 'none';
    }
});

// ИНИЦИАЛИЗАЦИЯ ПРИ ЗАГРУЗКЕ СТРАНИЦЫ
document.addEventListener('DOMContentLoaded', function() {
    // Обработчики кнопок входа/регистрации
    document.getElementById('loginBtn').addEventListener('click', async () => {
        const email = document.getElementById('loginEmail').value;
        const password = document.getElementById('loginPassword').value;
        
        if (!email || !password) {
            alert('Введите email и пароль');
            return;
        }
        
        await login(email, password);
    });
    
    document.getElementById('registerBtn').addEventListener('click', async () => {
        const email = document.getElementById('loginEmail').value;
        const password = document.getElementById('loginPassword').value;
        
        if (!email || !password) {
            alert('Введите email и пароль');
            return;
        }
        
        if (password.length < 6) {
            alert('Пароль должен быть минимум 6 символов');
            return;
        }
        
        const name = prompt('Введите ваше имя:') || email.split('@')[0];
        await register(email, password, name);
    });
    
    // Кнопка выхода
    document.getElementById('logoutBtn').addEventListener('click', logout);
    
    // Кнопка создания тренировки
    document.getElementById('createTrainingBtn')?.addEventListener('click', openTrainingModal);
    document.getElementById('btnCreateTraining')?.addEventListener('click', openTrainingModal);
    
    // Модальное окно
    document.getElementById('saveTrainingBtn').addEventListener('click', createTraining);
    document.getElementById('cancelTrainingBtn').addEventListener('click', closeModal);
    document.getElementById('modalOverlay').addEventListener('click', closeModal);
    
    // Нижнее меню
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const screen = this.dataset.screen;
            if (screen) {
                showScreen(screen);
            }
        });
    });
    
    // Тестовые аккаунты (быстрый вход)
    document.querySelectorAll('.demo-accounts p').forEach(p => {
        p.addEventListener('click', function(e) {
            const text = e.target.textContent;
            if (text.includes('user@test.com')) {
                document.getElementById('loginEmail').value = 'user@test.com';
                document.getElementById('loginPassword').value = '123456';
            } else if (text.includes('trainer@test.com')) {
                document.getElementById('loginEmail').value = 'trainer@test.com';
                document.getElementById('loginPassword').value = '123456';
            }
        });
    });
    
    // Автофокус на поле email
    document.getElementById('loginEmail')?.focus();
});
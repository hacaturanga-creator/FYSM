// ============================================
// FITBOOK - ПОЛНОЕ ПРИЛОЖЕНИЕ ДЛЯ ЗАПИСИ НА ТРЕНИРОВКИ
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

// ИНИЦИАЛИЗАЦИЯ
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

// ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ
let currentUser = null;
let userData = null;
let selectedTrainingId = null;
let selectedTrainingPrice = 0;

// ============================================
// 🔐 ОСНОВНЫЕ ФУНКЦИИ
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
    
    // Загрузить данные для экрана
    switch(screenName) {
        case 'schedule':
            loadTrainings();
            break;
        case 'balance':
            loadTransactions();
            break;
        case 'myBookings':
            loadMyBookings();
            break;
        case 'ratings':
            loadMyRatings();
            break;
        case 'trainer':
            loadTrainerStats();
            break;
    }
}

// ОТКРЫТЬ МОДАЛЬНОЕ ОКНО
function openModal(modalId) {
    document.getElementById(modalId).style.display = 'flex';
}

// ЗАКРЫТЬ МОДАЛЬНОЕ ОКНО
function closeModal(modalId) {
    document.getElementById(modalId).style.display = 'none';
}

// ============================================
// 🔐 АВТОРИЗАЦИЯ
// ============================================

// РЕГИСТРАЦИЯ
async function register() {
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
    
    try {
        const userCredential = await auth.createUserWithEmailAndPassword(email, password);
        const user = userCredential.user;
        
        await db.collection('users').doc(user.uid).set({
            name: email.split('@')[0],
            email: email,
            role: 'user',
            balance: 100,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        alert('✅ Регистрация успешна! Вам начислено 100 баллов.');
    } catch (error) {
        alert('❌ Ошибка регистрации: ' + error.message);
    }
}

// ВХОД
async function login() {
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;
    
    if (!email || !password) {
        alert('Введите email и пароль');
        return;
    }
    
    try {
        await auth.signInWithEmailAndPassword(email, password);
    } catch (error) {
        alert('❌ Ошибка входа: ' + error.message);
    }
}

// ВЫХОД
async function logout() {
    if (confirm('Выйти из системы?')) {
        await auth.signOut();
    }
}

// ЗАГРУЗКА ДАННЫХ ПОЛЬЗОВАТЕЛЯ
async function loadUserData() {
    if (!currentUser) return;
    
    try {
        const userDoc = await db.collection('users').doc(currentUser.uid).get();
        if (userDoc.exists) {
            userData = userDoc.data();
            updateUI();
        }
    } catch (error) {
        console.error('Ошибка загрузки данных:', error);
    }
}

// ОБНОВЛЕНИЕ ИНТЕРФЕЙСА
function updateUI() {
    if (!userData) return;
    
    // Имя пользователя
    document.getElementById('userName').textContent = userData.name || userData.email;
    
    // Баланс
    document.getElementById('balanceAmount').textContent = userData.balance || 0;
    
    // Кнопка выхода
    document.getElementById('logoutBtn').classList.remove('hidden');
    
    // Нижнее меню
    document.querySelector('.bottom-nav').style.display = 'flex';
    
    // Панель тренера
    const trainerNavBtn = document.getElementById('trainerNavBtn');
    if (userData.role === 'trainer') {
        trainerNavBtn.style.display = 'flex';
    } else {
        trainerNavBtn.style.display = 'none';
    }
}

// ============================================
// 🏋️‍♂️ ФУНКЦИИ ТРЕНИРОВОК (для всех)
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
        container.innerHTML = '';
        
        if (querySnapshot.empty) {
            container.innerHTML = '<p class="text-center">Нет предстоящих тренировок</p>';
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
                    <span><i class="fas fa-users"></i> ${training.maxParticipants || 'Без ограничений'}</span>
                </div>
                ${training.description ? `<p>${training.description}</p>` : ''}
                ${training.trainerName ? `<p><small><i class="fas fa-user-tie"></i> ${training.trainerName}</small></p>` : ''}
                
                <div class="mt-2">
                    ${userData && userData.role === 'trainer' ? `
                        <button onclick="editTraining('${doc.id}')" class="btn-secondary" style="width:100%;">
                            <i class="fas fa-edit"></i> Редактировать
                        </button>
                    ` : `
                        <button onclick="openRegisterModal('${doc.id}', ${training.price || 0}, '${training.title}')" 
                                class="btn-primary" style="width:100%;"
                                ${userData && userData.balance < (training.price || 0) ? 'disabled' : ''}>
                            <i class="fas fa-calendar-plus"></i> Записаться
                        </button>
                    `}
                </div>
            `;
            
            container.appendChild(card);
        });
    } catch (error) {
        console.error('Ошибка загрузки тренировок:', error);
        document.getElementById('trainingsList').innerHTML = `
            <p class="text-center">Ошибка загрузки тренировок</p>
        `;
    }
}

// ОБНОВИТЬ РАСПИСАНИЕ
function refreshSchedule() {
    loadTrainings();
    alert('Расписание обновлено!');
}

// ============================================
// 💰 ФУНКЦИИ БАЛАНСА И ТРАНЗАКЦИЙ
// ============================================

// ЗАГРУЗКА ТРАНЗАКЦИЙ
async function loadTransactions() {
    try {
        const querySnapshot = await db.collection('transactions')
            .where('userId', '==', currentUser.uid)
            .orderBy('createdAt', 'desc')
            .limit(20)
            .get();
        
        const container = document.getElementById('transactionsList');
        
        if (querySnapshot.empty) {
            container.innerHTML = '<p class="text-center">Нет транзакций</p>';
            return;
        }
        
        let html = `
            <table>
                <thead>
                    <tr>
                        <th>Дата</th>
                        <th>Описание</th>
                        <th>Сумма</th>
                        <th>Тип</th>
                    </tr>
                </thead>
                <tbody>
        `;
        
        querySnapshot.forEach(doc => {
            const trans = doc.data();
            const date = trans.createdAt?.toDate() || new Date();
            const typeClass = trans.type === 'credit' ? 'status-success' : 'status-danger';
            
            html += `
                <tr>
                    <td>${date.toLocaleDateString()}</td>
                    <td>${trans.description || '-'}</td>
                    <td>${trans.amount}</td>
                    <td><span class="status-badge ${typeClass}">${trans.type === 'credit' ? 'Начисление' : 'Списание'}</span></td>
                </tr>
            `;
        });
        
        html += `</tbody></table>`;
        container.innerHTML = html;
    } catch (error) {
        console.error('Ошибка загрузки транзакций:', error);
    }
}

// ============================================
// 📝 ФУНКЦИИ ЗАПИСЕЙ ПОЛЬЗОВАТЕЛЯ
// ============================================

// ЗАГРУЗКА МОИХ ЗАПИСЕЙ
async function loadMyBookings() {
    try {
        const querySnapshot = await db.collection('registrations')
            .where('userId', '==', currentUser.uid)
            .orderBy('registeredAt', 'desc')
            .limit(20)
            .get();
        
        const container = document.getElementById('myBookingsList');
        
        if (querySnapshot.empty) {
            container.innerHTML = '<p class="text-center">У вас нет записей на тренировки</p>';
            return;
        }
        
        let html = `
            <table>
                <thead>
                    <tr>
                        <th>Тренировка</th>
                        <th>Дата</th>
                        <th>Стоимость</th>
                        <th>Статус</th>
                        <th>Присутствие</th>
                    </tr>
                </thead>
                <tbody>
        `;
        
        // Получаем данные о тренировках
        const trainingPromises = [];
        const registrations = [];
        
        querySnapshot.forEach(doc => {
            const reg = doc.data();
            reg.id = doc.id;
            registrations.push(reg);
            trainingPromises.push(db.collection('trainings').doc(reg.trainingId).get());
        });
        
        const trainingSnapshots = await Promise.all(trainingPromises);
        const trainings = {};
        trainingSnapshots.forEach((snap, index) => {
            if (snap.exists) {
                trainings[registrations[index].trainingId] = snap.data();
            }
        });
        
        // Формируем таблицу
        registrations.forEach(reg => {
            const training = trainings[reg.trainingId] || {};
            const date = training.date?.toDate() || new Date();
            const statusClass = reg.attended ? 'status-success' : 'status-warning';
            const attendanceClass = reg.attended ? 'status-success' : 'status-danger';
            
            html += `
                <tr>
                    <td>${training.title || 'Неизвестно'}</td>
                    <td>${date.toLocaleDateString()}</td>
                    <td>${training.price || 0} баллов</td>
                    <td><span class="status-badge ${statusClass}">${reg.charged ? 'Оплачено' : 'Не оплачено'}</span></td>
                    <td><span class="status-badge ${attendanceClass}">${reg.attended ? 'Присутствовал' : 'Не отмечено'}</span></td>
                </tr>
            `;
        });
        
        html += `</tbody></table>`;
        container.innerHTML = html;
    } catch (error) {
        console.error('Ошибка загрузки записей:', error);
        document.getElementById('myBookingsList').innerHTML = '<p class="text-center">Ошибка загрузки данных</p>';
    }
}

// ============================================
// ⭐ ФУНКЦИИ ОЦЕНОК
// ============================================

// ЗАГРУЗКА МОИХ ОЦЕНОК
async function loadMyRatings() {
    try {
        const querySnapshot = await db.collection('ratings')
            .where('userId', '==', currentUser.uid)
            .orderBy('createdAt', 'desc')
            .limit(20)
            .get();
        
        const container = document.getElementById('ratingsList');
        
        if (querySnapshot.empty) {
            container.innerHTML = '<p class="text-center">У вас пока нет оценок</p>';
            return;
        }
        
        let html = `
            <table>
                <thead>
                    <tr>
                        <th>Тренировка</th>
                        <th>Дата</th>
                        <th>Оценка</th>
                        <th>Комментарий</th>
                        <th>Тренер</th>
                    </tr>
                </thead>
                <tbody>
        `;
        
        // Получаем данные о тренировках
        const trainingPromises = [];
        const ratings = [];
        
        querySnapshot.forEach(doc => {
            const rating = doc.data();
            rating.id = doc.id;
            ratings.push(rating);
            trainingPromises.push(db.collection('trainings').doc(rating.trainingId).get());
        });
        
        const trainingSnapshots = await Promise.all(trainingPromises);
        
        ratings.forEach((rating, index) => {
            const training = trainingSnapshots[index].exists ? trainingSnapshots[index].data() : {};
            const date = rating.createdAt?.toDate() || new Date();
            
            // Создаем звезды для оценки
            const stars = '★'.repeat(rating.score) + '☆'.repeat(5 - rating.score);
            
            html += `
                <tr>
                    <td>${training.title || 'Неизвестно'}</td>
                    <td>${date.toLocaleDateString()}</td>
                    <td><span style="color: gold; font-size: 1.2em;">${stars}</span> (${rating.score}/5)</td>
                    <td>${rating.comment || 'Нет комментария'}</td>
                    <td>${rating.trainerName || 'Тренер'}</td>
                </tr>
            `;
        });
        
        html += `</tbody></table>`;
        container.innerHTML = html;
    } catch (error) {
        console.error('Ошибка загрузки оценок:', error);
        document.getElementById('ratingsList').innerHTML = '<p class="text-center">Ошибка загрузки данных</p>';
    }
}

// ============================================
// 👨‍🏫 ФУНКЦИИ ТРЕНЕРА
// ============================================

// ОТКРЫТЬ МОДАЛКУ СОЗДАНИЯ ТРЕНИРОВКИ
function openCreateTrainingModal() {
    if (userData.role !== 'trainer') {
        alert('Только тренер может создавать тренировки');
        return;
    }
    
    // Установить дату по умолчанию (завтра, 19:00)
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(19, 0, 0, 0);
    
    document.getElementById('trainingDate').value = tomorrow.toISOString().slice(0, 16);
    openModal('createTrainingModal');
}

// СОЗДАТЬ ТРЕНИРОВКУ
async function createTraining() {
    if (userData.role !== 'trainer') {
        alert('Только тренер может создавать тренировки');
        return;
    }
    
    const title = document.getElementById('trainingTitle').value;
    const date = document.getElementById('trainingDate').value;
    const price = document.getElementById('trainingPrice').value;
    const max = document.getElementById('trainingMax').value;
    const desc = document.getElementById('trainingDesc').value;
    
    if (!title || !date || !price) {
        alert('Заполните обязательные поля: название, дата и стоимость');
        return;
    }
    
    try {
        await db.collection('trainings').add({
            title: title,
            date: firebase.firestore.Timestamp.fromDate(new Date(date)),
            price: parseInt(price),
            maxParticipants: max ? parseInt(max) : null,
            description: desc || '',
            trainerId: currentUser.uid,
            trainerName: userData.name,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        alert('✅ Тренировка создана!');
        closeModal('createTrainingModal');
        loadTrainings();
        
        // Очистить поля
        document.getElementById('trainingTitle').value = '';
        document.getElementById('trainingPrice').value = '';
        document.getElementById('trainingDesc').value = '';
        
    } catch (error) {
        alert('❌ Ошибка: ' + error.message);
    }
}

// ОТКРЫТЬ МОДАЛКУ ОТМЕТКИ ПРИСУТСТВИЯ
async function openAttendanceModal() {
    if (userData.role !== 'trainer') {
        alert('Только тренер может отмечать присутствие');
        return;
    }
    
    try {
        // Загрузить тренировки тренера
        const trainingsSnapshot = await db.collection('trainings')
            .where('trainerId', '==', currentUser.uid)
            .where('date', '<=', firebase.firestore.Timestamp.now())
            .orderBy('date', 'desc')
            .limit(10)
            .get();
        
        const select = document.getElementById('attendanceTraining');
        select.innerHTML = '<option value="">Выберите тренировку</option>';
        
        trainingsSnapshot.forEach(doc => {
            const training = doc.data();
            const date = training.date.toDate();
            const option = document.createElement('option');
            option.value = doc.id;
            option.textContent = `${training.title} (${date.toLocaleDateString()})`;
            select.appendChild(option);
        });
        
        // Обработчик выбора тренировки
        select.onchange = async function() {
            if (!this.value) return;
            
            const trainingId = this.value;
            const usersDiv = document.getElementById('attendanceUsers');
            usersDiv.innerHTML = '<p>Загрузка записей...</p>';
            
            // Загрузить записи на эту тренировку
            const registrationsSnapshot = await db.collection('registrations')
                .where('trainingId', '==', trainingId)
                .get();
            
            if (registrationsSnapshot.empty) {
                usersDiv.innerHTML = '<p>На эту тренировку нет записей</p>';
                return;
            }
            
            let html = '<h4>Участники:</h4>';
            
            const userPromises = [];
            const registrations = [];
            
            registrationsSnapshot.forEach(doc => {
                const reg = doc.data();
                reg.id = doc.id;
                registrations.push(reg);
                userPromises.push(db.collection('users').doc(reg.userId).get());
            });
            
            const userSnapshots = await Promise.all(userPromises);
            
            registrations.forEach((reg, index) => {
                const user = userSnapshots[index].exists ? userSnapshots[index].data() : {};
                const checked = reg.attended ? 'checked' : '';
                
                html += `
                    <div style="display: flex; align-items: center; gap: 10px; margin: 10px 0; padding: 10px; background: #f8f9fa; border-radius: 8px;">
                        <input type="checkbox" id="user_${reg.id}" ${checked} data-registration="${reg.id}" data-user="${reg.userId}">
                        <label for="user_${reg.id}" style="flex: 1;">
                            <strong>${user.name || user.email || 'Неизвестный'}</strong>
                            ${reg.willAttend ? '✅ Буду присутствовать' : '❌ Не придет'}
                        </label>
                    </div>
                `;
            });
            
            usersDiv.innerHTML = html;
        };
        
        openModal('attendanceModal');
    } catch (error) {
        alert('Ошибка загрузки данных: ' + error.message);
    }
}

// СОХРАНИТЬ ОТМЕТКИ ПРИСУТСТВИЯ
async function saveAttendance() {
    const trainingId = document.getElementById('attendanceTraining').value;
    if (!trainingId) {
        alert('Выберите тренировку');
        return;
    }
    
    const checkboxes = document.querySelectorAll('#attendanceUsers input[type="checkbox"]');
    let updated = 0;
    
    try {
        for (const checkbox of checkboxes) {
            const registrationId = checkbox.dataset.registration;
            const userId = checkbox.dataset.user;
            const attended = checkbox.checked;
            
            // Обновляем запись о регистрации
            await db.collection('registrations').doc(registrationId).update({
                attended: attended,
                attendedAt: attended ? firebase.firestore.FieldValue.serverTimestamp() : null
            });
            
            // Если отметили присутствие и еще не списывали - списываем
            if (attended) {
                const registrationDoc = await db.collection('registrations').doc(registrationId).get();
                const registration = registrationDoc.data();
                
                if (!registration.charged) {
                    // Получаем стоимость тренировки
                    const trainingDoc = await db.collection('trainings').doc(trainingId).get();
                    const training = trainingDoc.data();
                    
                    // Списываем баланс через транзакцию
                    await db.runTransaction(async (transaction) => {
                        const userRef = db.collection('users').doc(userId);
                        const userDoc = await transaction.get(userRef);
                        
                        if (userDoc.exists) {
                            const currentBalance = userDoc.data().balance;
                            const newBalance = currentBalance - (training.price || 0);
                            
                            transaction.update(userRef, { balance: newBalance });
                            transaction.update(db.collection('registrations').doc(registrationId), { 
                                charged: true 
                            });
                            
                            // Создаем транзакцию
                            const transRef = db.collection('transactions').doc();
                            transaction.set(transRef, {
                                userId: userId,
                                trainingId: trainingId,
                                amount: training.price || 0,
                                type: 'debit',
                                description: `Списание за тренировку: ${training.title}`,
                                createdBy: currentUser.uid,
                                createdAt: firebase.firestore.FieldValue.serverTimestamp()
                            });
                        }
                    });
                }
            }
            
            updated++;
        }
        
        alert(`✅ Обновлено ${updated} записей`);
        closeModal('attendanceModal');
    } catch (error) {
        alert('❌ Ошибка сохранения: ' + error.message);
    }
}

// ОТКРЫТЬ МОДАЛКУ НАЧИСЛЕНИЯ БАЛАНСА
async function openAdjustBalanceModal() {
    if (userData.role !== 'trainer') {
        alert('Только тренер может изменять баланс');
        return;
    }
    
    try {
        // Загрузить всех пользователей
        const usersSnapshot = await db.collection('users')
            .where('role', '==', 'user')
            .limit(50)
            .get();
        
        const select = document.getElementById('balanceUser');
        select.innerHTML = '<option value="">Выберите пользователя</option>';
        
        usersSnapshot.forEach(doc => {
            const user = doc.data();
            const option = document.createElement('option');
            option.value = doc.id;
            option.textContent = `${user.name || user.email} (Баланс: ${user.balance || 0})`;
            select.appendChild(option);
        });
        
        openModal('balanceModal');
    } catch (error) {
        alert('Ошибка загрузки пользователей: ' + error.message);
    }
}

// СОХРАНИТЬ ИЗМЕНЕНИЕ БАЛАНСА
async function saveBalanceAdjustment() {
    const userId = document.getElementById('balanceUser').value;
    const amount = parseInt(document.getElementById('balanceAmount').value);
    const reason = document.getElementById('balanceReason').value;
    
    if (!userId || !amount || isNaN(amount)) {
        alert('Заполните все поля корректно');
        return;
    }
    
    if (!reason) {
        alert('Укажите причину изменения баланса');
        return;
    }
    
    try {
        await db.runTransaction(async (transaction) => {
            const userRef = db.collection('users').doc(userId);
            const userDoc = await transaction.get(userRef);
            
            if (!userDoc.exists) {
                throw new Error('Пользователь не найден');
            }
            
            const currentBalance = userDoc.data().balance;
            const newBalance = currentBalance + amount;
            
            // Обновляем баланс
            transaction.update(userRef, { 
                balance: newBalance 
            });
            
            // Создаем транзакцию
            const transRef = db.collection('transactions').doc();
            transaction.set(transRef, {
                userId: userId,
                amount: Math.abs(amount),
                type: amount >= 0 ? 'credit' : 'debit',
                description: reason,
                createdBy: currentUser.uid,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
        });
        
        alert(`✅ Баланс успешно обновлен на ${amount} баллов`);
        closeModal('balanceModal');
        
        // Очистить поля
        document.getElementById('balanceAmount').value = '';
        document.getElementById('balanceReason').value = '';
        
    } catch (error) {
        alert('❌ Ошибка: ' + error.message);
    }
}

// ОТКРЫТЬ МОДАЛКУ ВЫСТАВЛЕНИЯ ОЦЕНОК
async function openRateUsersModal() {
    if (userData.role !== 'trainer') {
        alert('Только тренер может выставлять оценки');
        return;
    }
    
    try {
        // Загрузить тренировки тренера
        const trainingsSnapshot = await db.collection('trainings')
            .where('trainerId', '==', currentUser.uid)
            .orderBy('date', 'desc')
            .limit(10)
            .get();
        
        const select = document.getElementById('ratingTraining');
        select.innerHTML = '<option value="">Выберите тренировку</option>';
        
        trainingsSnapshot.forEach(doc => {
            const training = doc.data();
            const date = training.date.toDate();
            const option = document.createElement('option');
            option.value = doc.id;
            option.textContent = `${training.title} (${date.toLocaleDateString()})`;
            select.appendChild(option);
        });
        
        // Обработчик выбора тренировки
        select.onchange = async function() {
            if (!this.value) return;
            
            const trainingId = this.value;
            const usersDiv = document.getElementById('ratingUsers');
            usersDiv.innerHTML = '<p>Загрузка участников...</p>';
            
            // Загрузить участников тренировки
            const registrationsSnapshot = await db.collection('registrations')
                .where('trainingId', '==', trainingId)
                .where('attended', '==', true)
                .get();
            
            if (registrationsSnapshot.empty) {
                usersDiv.innerHTML = '<p>На этой тренировке не было участников</p>';
                return;
            }
            
            let html = '<h4>Участники для оценки:</h4>';
            
            const userPromises = [];
            const registrations = [];
            
            registrationsSnapshot.forEach(doc => {
                const reg = doc.data();
                reg.id = doc.id;
                registrations.push(reg);
                userPromises.push(db.collection('users').doc(reg.userId).get());
            });
            
            const userSnapshots = await Promise.all(userPromises);
            
            registrations.forEach((reg, index) => {
                const user = userSnapshots[index].exists ? userSnapshots[index].data() : {};
                
                html += `
                    <div style="margin: 15px 0; padding: 15px; background: #f8f9fa; border-radius: 10px;">
                        <strong>${user.name || user.email || 'Неизвестный'}</strong>
                        
                        <div style="margin: 10px 0;">
                            <label>Оценка (1-5):</label>
                            <select id="score_${reg.userId}" style="margin-left: 10px; padding: 5px;">
                                <option value="1">1 ★</option>
                                <option value="2">2 ★★</option>
                                <option value="3" selected>3 ★★★</option>
                                <option value="4">4 ★★★★</option>
                                <option value="5">5 ★★★★★</option>
                            </select>
                        </div>
                        
                        <div>
                            <label>Комментарий:</label>
                            <textarea id="comment_${reg.userId}" 
                                      placeholder="Отзыв о тренировке" 
                                      style="width: 100%; padding: 8px; margin-top: 5px; border-radius: 5px; border: 1px solid #ddd;"></textarea>
                        </div>
                    </div>
                `;
            });
            
            usersDiv.innerHTML = html;
        };
        
        openModal('ratingsModal');
    } catch (error) {
        alert('Ошибка загрузки данных: ' + error.message);
    }
}

// СОХРАНИТЬ ОЦЕНКИ
async function saveRatings() {
    const trainingId = document.getElementById('ratingTraining').value;
    if (!trainingId) {
        alert('Выберите тренировку');
        return;
    }
    
    // Получаем данные о тренировке
    const trainingDoc = await db.collection('trainings').doc(trainingId).get();
    const training = trainingDoc.data();
    
    // Получаем участников
    const registrationsSnapshot = await db.collection('registrations')
        .where('trainingId', '==', trainingId)
        .where('attended', '==', true)
        .get();
    
    let saved = 0;
    
    try {
        for (const doc of registrationsSnapshot.docs) {
            const reg = doc.data();
            const userId = reg.userId;
            
            const score = document.getElementById(`score_${userId}`)?.value;
            const comment = document.getElementById(`comment_${userId}`)?.value;
            
            if (score) {
                // Сохраняем оценку
                await db.collection('ratings').add({
                    userId: userId,
                    trainingId: trainingId,
                    score: parseInt(score),
                    comment: comment || '',
                    trainerId: currentUser.uid,
                    trainerName: userData.name,
                    trainingTitle: training.title,
                    createdAt: firebase.firestore.FieldValue.serverTimestamp()
                });
                
                saved++;
            }
        }
        
        alert(`✅ Сохранено ${saved} оценок`);
        closeModal('ratingsModal');
    } catch (error) {
        alert('❌ Ошибка сохранения оценок: ' + error.message);
    }
}

// ЗАГРУЗКА СТАТИСТИКИ ТРЕНЕРА
async function loadTrainerStats() {
    if (userData.role !== 'trainer') return;
    
    try {
        // Получаем тренировки тренера
        const trainingsSnapshot = await db.collection('trainings')
            .where('trainerId', '==', currentUser.uid)
            .get();
        
        // Получаем записи на эти тренировки
        let totalParticipants = 0;
        let totalRevenue = 0;
        let upcomingTrainings = 0;
        let pastTrainings = 0;
        
        const now = firebase.firestore.Timestamp.now();
        
        for (const doc of trainingsSnapshot.docs) {
            const training = doc.data();
            const isPast = training.date.toDate() < now.toDate();
            
            if (isPast) {
                pastTrainings++;
            } else {
                upcomingTrainings++;
            }
            
            // Подсчет участников
            const registrationsSnapshot = await db.collection('registrations')
                .where('trainingId', '==', doc.id)
                .get();
            
            totalParticipants += registrationsSnapshot.size;
            
            // Подсчет выручки
            registrationsSnapshot.forEach(regDoc => {
                if (regDoc.data().charged) {
                    totalRevenue += training.price || 0;
                }
            });
        }
        
        const statsDiv = document.getElementById('trainerStats');
        statsDiv.innerHTML = `
            <h3><i class="fas fa-chart-line"></i> Статистика</h3>
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin-top: 15px;">
                <div style="background: #e3f2fd; padding: 15px; border-radius: 10px; text-align: center;">
                    <div style="font-size: 24px; font-weight: bold; color: #1976d2;">${trainingsSnapshot.size}</div>
                    <div>Всего тренировок</div>
                </div>
                <div style="background: #f3e5f5; padding: 15px; border-radius: 10px; text-align: center;">
                    <div style="font-size: 24px; font-weight: bold; color: #7b1fa2;">${upcomingTrainings}</div>
                    <div>Предстоящих</div>
                </div>
                <div style="background: #e8f5e9; padding: 15px; border-radius: 10px; text-align: center;">
                    <div style="font-size: 24px; font-weight: bold; color: #388e3c;">${pastTrainings}</div>
                    <div>Проведенных</div>
                </div>
                <div style="background: #fff3e0; padding: 15px; border-radius: 10px; text-align: center;">
                    <div style="font-size: 24px; font-weight: bold; color: #f57c00;">${totalParticipants}</div>
                    <div>Участников всего</div>
                </div>
                <div style="background: #fce4ec; padding: 15px; border-radius: 10px; text-align: center;">
                    <div style="font-size: 24px; font-weight: bold; color: #c2185b;">${totalRevenue}</div>
                    <div>Всего баллов списано</div>
                </div>
            </div>
        `;
    } catch (error) {
        console.error('Ошибка загрузки статистики:', error);
    }
}

// ============================================
// 📋 ФУНКЦИИ ЗАПИСИ НА ТРЕНИРОВКИ
// ============================================

// ОТКРЫТЬ МОДАЛКУ ЗАПИСИ
function openRegisterModal(trainingId, price, title) {
    selectedTrainingId = trainingId;
    selectedTrainingPrice = price;
    
    document.getElementById('registerTrainingTitle').textContent = title;
    document.getElementById('registerTrainingPrice').textContent = price;
    document.getElementById('registerUserBalance').textContent = userData.balance;
    
    openModal('registerModal');
}

// ПОДТВЕРДИТЬ ЗАПИСЬ НА ТРЕНИРОВКУ
async function confirmRegistration() {
    if (!selectedTrainingId || !userData) return;
    
    if (userData.balance < selectedTrainingPrice) {
        alert(`❌ Недостаточно баллов! Нужно: ${selectedTrainingPrice}, у вас: ${userData.balance}`);
        closeModal('registerModal');
        return;
    }
    
    try {
        await db.runTransaction(async (transaction) => {
            // Проверяем баланс
            const userRef = db.collection('users').doc(currentUser.uid);
            const userDoc = await transaction.get(userRef);
            const currentBalance = userDoc.data().balance;
            
            if (currentBalance < selectedTrainingPrice) {
                throw new Error('Недостаточно баллов');
            }
            
            // Проверяем, не записан ли уже
            const registrationsQuery = await db.collection('registrations')
                .where('userId', '==', currentUser.uid)
                .where('trainingId', '==', selectedTrainingId)
                .get();
            
            if (!registrationsQuery.empty) {
                throw new Error('Вы уже записаны на эту тренировку');
            }
            
            // Получаем данные о тренировке
            const trainingRef = db.collection('trainings').doc(selectedTrainingId);
            const trainingDoc = await transaction.get(trainingRef);
            const training = trainingDoc.data();
            
            // Проверяем количество участников
            const participantsQuery = await db.collection('registrations')
                .where('trainingId', '==', selectedTrainingId)
                .get();
            
            if (training.maxParticipants && participantsQuery.size >= training.maxParticipants) {
                throw new Error('На тренировку уже нет свободных мест');
            }
            
            // Списываем баллы
            transaction.update(userRef, {
                balance: currentBalance - selectedTrainingPrice
            });
            
            // Создаем запись о регистрации
            const regRef = db.collection('registrations').doc();
            transaction.set(regRef, {
                userId: currentUser.uid,
                trainingId: selectedTrainingId,
                willAttend: true,
                attended: false,
                charged: true,
                registeredAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            
            // Создаем транзакцию
            const transRef = db.collection('transactions').doc();
            transaction.set(transRef, {
                userId: currentUser.uid,
                trainingId: selectedTrainingId,
                amount: selectedTrainingPrice,
                type: 'debit',
                description: `Запись на тренировку: ${training.title}`,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
        });
        
        alert('✅ Вы успешно записаны на тренировку!');
        closeModal('registerModal');
        
        // Обновляем данные
        loadUserData();
        loadTrainings();
        if (document.getElementById('myBookingsScreen').classList.contains('active')) {
            loadMyBookings();
        }
        
    } catch (error) {
        alert('❌ Ошибка записи: ' + error.message);
        closeModal('registerModal');
    }
}

// ============================================
// 🎯 ИНИЦИАЛИЗАЦИЯ
// ============================================

// СЛУШАТЕЛЬ СОСТОЯНИЯ АВТОРИЗАЦИИ
auth.onAuthStateChanged(async (user) => {
    if (user) {
        currentUser = user;
        await loadUserData();
        
        // Показать основное приложение
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
        
        // Скрыть кнопку выхода
        document.getElementById('logoutBtn').classList.add('hidden');
        document.getElementById('userName').textContent = 'Гость';
    }
});

// ИНИЦИАЛИЗАЦИЯ ПРИ ЗАГРУЗКЕ
document.addEventListener('DOMContentLoaded', function() {
    // Обработчики кнопок
    document.getElementById('loginBtn').addEventListener('click', login);
    document.getElementById('registerBtn').addEventListener('click', register);
    document.getElementById('logoutBtn').addEventListener('click', logout);
    
    // Обработчики нижнего меню
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const screen = this.dataset.screen;
            if (screen) {
                showScreen(screen);
            }
        });
    });
    
    // Ввод по Enter в полях авторизации
    document.getElementById('loginPassword').addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            login();
        }
    });
    
    // Тестовые аккаунты (быстрый вход)
    document.querySelectorAll('.demo-accounts p').forEach(p => {
        p.addEventListener('click', function(e) {
            if (e.target.textContent.includes('user@test.com')) {
                document.getElementById('loginEmail').value = 'user@test.com';
                document.getElementById('loginPassword').value = '123456';
            } else if (e.target.textContent.includes('trainer@test.com')) {
                document.getElementById('loginEmail').value = 'trainer@test.com';
                document.getElementById('loginPassword').value = '123456';
            }
        });
    });
    
    // Автофокус на поле email
    document.getElementById('loginEmail')?.focus();
});

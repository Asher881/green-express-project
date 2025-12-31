document.addEventListener('DOMContentLoaded', () => {

    // --- 数据模拟 (LocalStorage) ---
    // 用户数据结构: [{ username, password, points, avatar, info: {}, regDate }]
    let users = JSON.parse(localStorage.getItem('greenUsers')) || [];
    
    // 上传记录数据结构: [{ id, username, image, type, status, timestamp }]
    // status: 'pending'(待审核), 'approved'(已通过), 'rejected'(已驳回)
    let uploads = JSON.parse(localStorage.getItem('greenUploads')) || [];

    let currentUser = null;
    let isAdmin = false;

    // DOM 元素引用
    const authSection = document.getElementById('auth-section');
    const appContainer = document.getElementById('app-container');
    const mainNav = document.getElementById('main-nav');
    const pageTitle = document.getElementById('page-title');

    // --- 1. 认证模块 (Auth) ---

    window.switchAuth = (type) => {
        // 重置所有表单显示
        document.querySelectorAll('.auth-form').forEach(f => f.classList.remove('active'));
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));

        if (type === 'login') {
            document.getElementById('login-form').classList.add('active');
            document.querySelectorAll('.tab-btn')[0].classList.add('active');
        } else if (type === 'register') {
            document.getElementById('register-form').classList.add('active');
            document.querySelectorAll('.tab-btn')[1].classList.add('active');
        } else if (type === 'admin') {
            document.getElementById('admin-login-form').classList.add('active');
            document.querySelectorAll('.tab-btn')[2].classList.add('active');
        }
    };

    // 普通用户注册
    document.getElementById('register-form').addEventListener('submit', (e) => {
        e.preventDefault();
        const user = document.getElementById('reg-user').value.trim();
        const pass = document.getElementById('reg-pass').value.trim();

        if (users.find(u => u.username === user)) {
            alert('该用户名已被注册！');
            return;
        }

        const newUser = {
            username: user,
            password: pass,
            points: 0,
            avatar: 'https://via.placeholder.com/150',
            info: { realname: '', college: '', phone: '' },
            regDate: new Date().toLocaleDateString()
        };
        users.push(newUser);
        saveData();
        alert('注册成功，请登录！');
        switchAuth('login');
    });

    // 普通用户登录
    document.getElementById('login-form').addEventListener('submit', (e) => {
        e.preventDefault();
        const user = document.getElementById('login-user').value.trim();
        const pass = document.getElementById('login-pass').value.trim();

        const foundUser = users.find(u => u.username === user && u.password === pass);
        if (foundUser) {
            loginSuccess(foundUser, false);
        } else {
            alert('用户名或密码错误');
        }
    });

    // 管理员登录
    document.getElementById('admin-login-form').addEventListener('submit', (e) => {
        e.preventDefault();
        const user = document.getElementById('admin-user').value.trim();
        const pass = document.getElementById('admin-pass').value.trim();

        // 预设管理员账号: admin / 123456
        if (user === 'admin' && pass === '123456') {
            loginSuccess({ username: 'Administrator' }, true);
        } else {
            alert('管理员账号或密码错误！');
        }
    });

    function loginSuccess(user, adminFlag) {
        currentUser = user;
        isAdmin = adminFlag;
        
        // 隐藏认证界面，显示主容器
        authSection.style.display = 'none';
        
        // 显示导航栏
        mainNav.style.display = 'flex';
        
        if (isAdmin) {
            // === 管理员模式 ===
            document.getElementById('user-nav-list').style.display = 'none';
            document.getElementById('admin-nav-list').style.display = 'flex';
            pageTitle.innerText = "【绿循】后台管理系统";
            appContainer.style.display = 'block';

            // 默认跳转到数据监控
            navTo('admin-dashboard');
            renderAdminDashboard();
        } else {
            // === 普通用户模式 ===
            document.getElementById('user-nav-list').style.display = 'flex';
            document.getElementById('admin-nav-list').style.display = 'none';
            pageTitle.innerText = "【绿循】大学生快递包装回收平台";
            appContainer.style.display = 'block';
            
            // 初始化用户数据
            updateGlobalUI();
            initProfile();
            navTo('home');
        }
    }

    function saveData() {
        localStorage.setItem('greenUsers', JSON.stringify(users));
        localStorage.setItem('greenUploads', JSON.stringify(uploads));
    }

    // --- 2. 导航逻辑 ---
    const navItems = document.querySelectorAll('.nav-item');
    const sections = document.querySelectorAll('.page-section');

    window.navTo = (targetId) => {
        // 更新导航高亮
        navItems.forEach(item => {
            item.classList.remove('active');
            if (item.dataset.target === targetId) item.classList.add('active');
        });
        
        // 切换页面板块
        sections.forEach(sec => sec.classList.remove('active'));
        const targetSec = document.getElementById(targetId);
        if (targetSec) targetSec.classList.add('active');

        // 如果切到管理员页面，自动刷新数据
        if (isAdmin) {
            if (targetId === 'admin-audit') renderAuditList();
            if (targetId === 'admin-dashboard') renderAdminDashboard();
        }
    };

    navItems.forEach(item => {
        if (!item.getAttribute('onclick')) {
            item.addEventListener('click', () => navTo(item.dataset.target));
        }
    });

    window.logout = () => {
        if(confirm('确定要退出登录吗？')) {
            location.reload();
        }
    };

    // --- 3. 用户功能：拍照上传 ---
    const photoInput = document.getElementById('recycle-photo-input');
    const previewContainer = document.getElementById('preview-container');
    const imgPreview = document.getElementById('image-preview');
    let currentFileBase64 = null;

    // 图片预览逻辑
    if (photoInput) {
        photoInput.addEventListener('change', function(e) {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = function(evt) {
                    currentFileBase64 = evt.target.result;
                    imgPreview.src = currentFileBase64;
                    previewContainer.style.display = 'block';
                    document.querySelector('.upload-placeholder').style.display = 'none';
                };
                reader.readAsDataURL(file);
            }
        });
    }

    // 提交上传
    window.submitUpload = () => {
        if (!currentFileBase64) {
            alert('请先选择一张照片！');
            return;
        }
        const typeSelect = document.getElementById('recycle-type');
        const typeText = typeSelect.options[typeSelect.selectedIndex].text;

        const newUpload = {
            id: Date.now(), // 唯一ID
            username: currentUser.username,
            image: currentFileBase64,
            type: typeText,
            status: 'pending', // 待审核
            timestamp: new Date().toLocaleString()
        };

        uploads.push(newUpload);
        saveData();

        alert('提交成功！请等待管理员审核。');
        
        // 重置表单
        currentFileBase64 = null;
        photoInput.value = '';
        previewContainer.style.display = 'none';
        document.querySelector('.upload-placeholder').style.display = 'block';
    };

    // --- 4. 管理员功能 ---

    // A. 渲染数据监控看板
    window.renderAdminDashboard = () => {
        const tbody = document.querySelector('#user-list-table tbody');
        tbody.innerHTML = '';

        users.forEach(u => {
            // 计算地球状态
            let earthState = "荒芜";
            if (u.points >= 80) earthState = "生态天堂";
            else if (u.points >= 40) earthState = "恢复中";
            
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${u.username}</td>
                <td>${u.info.realname || '-'}</td>
                <td>${u.info.college || '-'}</td>
                <td style="color:green; font-weight:bold;">${u.points}</td>
                <td>${earthState}</td>
                <td>${u.regDate || '-'}</td>
            `;
            tbody.appendChild(tr);
        });
    };

    // B. 渲染审核列表
    window.renderAuditList = () => {
        const auditList = document.getElementById('audit-list');
        const noMsg = document.getElementById('no-audit-msg');
        auditList.innerHTML = '';

        // 只显示 pending (待审核) 的记录
        const pendingUploads = uploads.filter(up => up.status === 'pending');

        if (pendingUploads.length === 0) {
            noMsg.style.display = 'block';
            return;
        }
        noMsg.style.display = 'none';

        pendingUploads.forEach(item => {
            const card = document.createElement('div');
            card.className = 'audit-card';
            card.innerHTML = `
                <div class="audit-img-box" onclick="viewImage('${item.image}')">
                    <img src="${item.image}" alt="回收物">
                </div>
                <div class="audit-info">
                    <p><strong>用户:</strong> ${item.username}</p>
                    <p><strong>类型:</strong> ${item.type}</p>
                    <p><strong>时间:</strong> ${item.timestamp}</p>
                </div>
                <div style="display:flex; align-items:center; margin-bottom:5px;">
                    <label style="font-size:12px; margin-right:5px;">奖励积分:</label>
                    <input type="number" id="score-${item.id}" class="score-input" value="10">
                </div>
                <div class="audit-actions">
                    <button class="btn-approve" onclick="auditAction(${item.id}, 'approve')">通过</button>
                    <button class="btn-reject" onclick="auditAction(${item.id}, 'reject')">驳回</button>
                </div>
            `;
            auditList.appendChild(card);
        });
    };

    // 查看大图
    window.viewImage = (src) => {
        const win = window.open();
        win.document.write(`<img src="${src}" style="max-width:100%">`);
    };

    // 审核操作 (通过/驳回)
    window.auditAction = (id, action) => {
        const itemIndex = uploads.findIndex(u => u.id === id);
        if (itemIndex === -1) return;

        const item = uploads[itemIndex];
        
        if (action === 'approve') {
            const scoreInput = document.getElementById(`score-${id}`);
            const pointsToAdd = parseInt(scoreInput.value) || 0;

            // 找到对应用户并加分
            const userIndex = users.findIndex(u => u.username === item.username);
            if (userIndex !== -1) {
                users[userIndex].points += pointsToAdd;
                
                // 更新上传状态
                item.status = 'approved';
                item.auditTime = new Date().toLocaleString();
                item.pointsAwarded = pointsToAdd;
                
                alert(`审核通过！用户 ${item.username} 获得 ${pointsToAdd} 积分。`);
            } else {
                alert('用户数据异常，无法加分。');
                return;
            }
        } else {
            // 拒绝
            item.status = 'rejected';
            alert('已驳回该申请。');
        }

        saveData();
        renderAuditList(); // 刷新列表
    };


    // --- 5. 通用UI更新 (地球 & 积分) ---
    function updateGlobalUI() {
        if (!currentUser || isAdmin) return;

        // 获取最新用户数据
        const freshUser = users.find(u => u.username === currentUser.username);
        if (freshUser) currentUser = freshUser;

        // 更新各处积分显示
        const homePoints = document.getElementById('home-points');
        const profilePoints = document.getElementById('profile-points-num');
        if(homePoints) homePoints.innerText = currentUser.points;
        if(profilePoints) profilePoints.innerText = currentUser.points;

        updateEarth(currentUser.points);
    }

    function updateEarth(points) {
        const planet = document.getElementById('planet');
        const stageName = document.getElementById('earth-stage-name');
        const progressBar = document.getElementById('earth-progress');
        if(!planet) return;

        // 清除旧状态
        planet.classList.remove('stage-1', 'stage-2', 'stage-3', 'stage-4', 'stage-5');
        
        // 计算进度条
        let percent = Math.min((points / 100) * 100, 100);
        if(progressBar) progressBar.style.width = percent + '%';

        // 设置新状态
        if (points < 20) {
            planet.classList.add('stage-1');
            if(stageName) stageName.innerText = "荒芜地球 (积分<20)";
        } else if (points < 40) {
            planet.classList.add('stage-2');
            if(stageName) stageName.innerText = "萌芽初现 (20-40)";
        } else if (points < 60) {
            planet.classList.add('stage-3');
            if(stageName) stageName.innerText = "森林复苏 (40-60)";
        } else if (points < 80) {
            planet.classList.add('stage-4');
            if(stageName) stageName.innerText = "鸟语花香 (60-80)";
        } else {
            planet.classList.add('stage-5');
            if(stageName) stageName.innerText = "生态天堂 (>80)";
        }
    }

    // --- 6. 个人中心逻辑 ---
    function initProfile() {
        document.getElementById('profile-username').innerText = currentUser.username;
        document.getElementById('profile-avatar').src = currentUser.avatar;
        document.getElementById('p-realname').value = currentUser.info.realname || '';
        document.getElementById('p-college').value = currentUser.info.college || '';
        document.getElementById('p-phone').value = currentUser.info.phone || '';
    }
    
    // 头像上传
    const avatarInput = document.getElementById('avatar-input');
    if(avatarInput) {
        avatarInput.addEventListener('change', function(e) {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = function(evt) {
                    const userIdx = users.findIndex(u => u.username === currentUser.username);
                    if(userIdx !== -1) {
                        users[userIdx].avatar = evt.target.result;
                        currentUser.avatar = evt.target.result;
                        document.getElementById('profile-avatar').src = evt.target.result;
                        saveData();
                    }
                }
                reader.readAsDataURL(file);
            }
        });
    }

    window.saveProfile = () => {
        const userIdx = users.findIndex(u => u.username === currentUser.username);
        if(userIdx !== -1) {
            users[userIdx].info = {
                realname: document.getElementById('p-realname').value,
                college: document.getElementById('p-college').value,
                phone: document.getElementById('p-phone').value
            };
            saveData();
            alert('个人信息保存成功！');
        }
    };
    
    // --- 7. 其他辅助功能 ---
    window.switchKnowledge = (tabId) => {
        document.querySelectorAll('.k-content').forEach(c => c.classList.remove('active'));
        document.querySelectorAll('.k-tab').forEach(t => t.classList.remove('active'));
        document.getElementById('k-' + tabId).classList.add('active');
        
        // 简单Tab按钮高亮
        const tabs = document.querySelectorAll('.k-tab');
        if(tabId === 'video') tabs[0].classList.add('active');
        if(tabId === 'policy') tabs[1].classList.add('active');
        if(tabId === 'quiz') tabs[2].classList.add('active');
    };

    window.startQuiz = () => {
        alert("今日答题功能演示：\n题目：快递胶带属于什么垃圾？\n(模拟答对+2分)");
        const userIdx = users.findIndex(u => u.username === currentUser.username);
        users[userIdx].points += 2;
        saveData();
        updateGlobalUI();
    };

    window.exchange = (cost, name) => {
        if(currentUser.points >= cost) {
            const userIdx = users.findIndex(u => u.username === currentUser.username);
            users[userIdx].points -= cost;
            saveData();
            updateGlobalUI();
            alert(`成功兑换：${name}！消耗 ${cost} 积分。`);
        } else {
            alert('积分不足，快去回收或答题吧！');
        }
    };
});
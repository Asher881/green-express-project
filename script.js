document.addEventListener('DOMContentLoaded', () => {

    // --- 数据模拟 (LocalStorage) ---
    // 用户数据结构: [{ username, password, points, avatar, info: {}, regDate }]
    let users = JSON.parse(localStorage.getItem('greenUsers')) || [];
    
    // 上传记录数据结构: [{ id, username, image, type, status, timestamp }]
    let uploads = JSON.parse(localStorage.getItem('greenUploads')) || [];

    let currentUser = null;
    let isAdmin = false;

    // DOM 元素引用
    const authSection = document.getElementById('auth-section');
    const appContainer = document.getElementById('app-container');
    const mainNav = document.getElementById('main-nav');
    const pageTitle = document.getElementById('page-title');

    // =========================================
    // 1. 认证模块 (Auth)
    // =========================================

    window.switchAuth = (type) => {
        document.querySelectorAll('.auth-form').forEach(f => f.classList.remove('active'));
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));

        if (type === 'login') {
            document.getElementById('login-form').classList.add('active');
            document.querySelectorAll('.tab-btn')[0].classList.add('active');
        } else if (type === 'register') {
            document.getElementById('register-form').classList.add('active');
            document.querySelectorAll('.tab-btn')[1].classList.add('active');
        }
    };

    // 注册逻辑
    document.getElementById('register-form').addEventListener('submit', (e) => {
        e.preventDefault();
        const u = document.getElementById('r-username').value;
        const p = document.getElementById('r-password').value;

        if (users.find(user => user.username === u)) {
            alert('用户名已存在！');
            return;
        }

        const newUser = {
            username: u,
            password: p,
            points: 0,
            avatar: 'images/default-avatar.png',
            info: {},
            regDate: new Date().toLocaleDateString()
        };
        users.push(newUser);
        saveData();
        alert('注册成功，请登录！');
        switchAuth('login');
    });

    // 登录逻辑
    document.getElementById('login-form').addEventListener('submit', (e) => {
        e.preventDefault();
        const u = document.getElementById('l-username').value;
        const p = document.getElementById('l-password').value;

        // 管理员后门 (账号: admin / 密码: 123456)
        if (u === 'admin' && p === '123456') {
            loginAsAdmin();
            return;
        }

        const user = users.find(user => user.username === u && user.password === p);
        if (user) {
            currentUser = user;
            loginSuccess();
        } else {
            alert('用户名或密码错误！');
        }
    });

    function loginSuccess() {
        authSection.style.display = 'none';
        appContainer.style.display = 'block';
        mainNav.style.display = 'flex';
        isAdmin = false;
        
        // UI 更新
        document.getElementById('user-nav-list').style.display = 'flex';
        document.getElementById('admin-nav-list').style.display = 'none';
        document.body.classList.remove('admin-mode');
        
        // 加载用户数据
        updateGlobalUI();
        loadRecycleRecords();
        switchTab('home');
    }

    function loginAsAdmin() {
        authSection.style.display = 'none';
        appContainer.style.display = 'block';
        mainNav.style.display = 'flex';
        isAdmin = true;

        // UI 更新
        document.getElementById('user-nav-list').style.display = 'none';
        document.getElementById('admin-nav-list').style.display = 'flex';
        pageTitle.innerText = "【绿循】后台管理系统";
        document.body.classList.add('admin-mode');

        // 加载管理数据
        loadAdminDashboard();
        loadAuditList();
        
        // 隐藏不需要的板块
        document.querySelectorAll('.page-section').forEach(s => s.classList.remove('active'));
        document.getElementById('admin-dashboard').classList.add('active');
    }

    window.logout = () => {
        currentUser = null;
        isAdmin = false;
        location.reload();
    };

    function saveData() {
        localStorage.setItem('greenUsers', JSON.stringify(users));
        localStorage.setItem('greenUploads', JSON.stringify(uploads));
    }

    // =========================================
    // 2. 核心功能逻辑
    // =========================================

    // 导航切换
    const navItems = document.querySelectorAll('.nav-item');
    navItems.forEach(item => {
        item.addEventListener('click', () => {
            const target = item.getAttribute('data-target');
            if(target) switchTab(target);
        });
    });

    function switchTab(targetId) {
        // 移除所有高亮和显示
        navItems.forEach(i => i.classList.remove('active'));
        document.querySelectorAll('.page-section').forEach(s => s.classList.remove('active'));

        // 激活目标
        document.querySelector(`.nav-item[data-target="${targetId}"]`)?.classList.add('active');
        document.getElementById(targetId).classList.add('active');

        // 特殊处理
        if (targetId === 'earth' && !isAdmin) updateEarth(currentUser.points);
    }

    // 更新全局UI (积分、头像等)
    function updateGlobalUI() {
        if (!currentUser) return;
        
        // 首页信息
        document.getElementById('home-username').innerText = currentUser.username;
        document.getElementById('home-points').innerText = currentUser.points;
        
        // 个人中心信息
        document.getElementById('profile-username').innerText = currentUser.username;
        document.getElementById('profile-points-num').innerText = currentUser.points;
        if(currentUser.info.realname) document.getElementById('p-realname').value = currentUser.info.realname;
        
        // 更新地球状态
        updateEarth(currentUser.points);
        // --- 新增：检查今日答题状态，更新按钮样式 ---
    const startQuizBtn = document.getElementById('btn-quiz-start');
    // 如果找到了按钮，且用户已登录
    if (startQuizBtn && currentUser) {
        const today = new Date().toLocaleDateString();
        // 检查记录的日期是否是今天
        if (currentUser.lastQuizDate === today) {
            startQuizBtn.innerText = "今日已完成";
            startQuizBtn.classList.add('disabled'); // 加上CSS里的灰色样式
            startQuizBtn.disabled = true; // 真正的禁用属性
        } else {
            startQuizBtn.innerText = "开始挑战";
            startQuizBtn.classList.remove('disabled');
            startQuizBtn.disabled = false;
        }
    }
    }

    // 地球进化逻辑
    function updateEarth(points) {
        const planet = document.getElementById('planet');
        const stageName = document.getElementById('earth-stage-name');
        const progressBar = document.getElementById('earth-progress');

        if(!planet) return;

        planet.classList.remove('stage-1', 'stage-2', 'stage-3', 'stage-4', 'stage-5');

        let percent = Math.min((points / 100) * 100, 100);
        if(progressBar) progressBar.style.width = percent + '%';

        if (points < 20) {
            planet.classList.add('stage-1');
            if(stageName) stageName.innerText = "荒芜地球 (积分 < 20)";
        } else if (points < 40) {
            planet.classList.add('stage-2');
            if(stageName) stageName.innerText = "萌芽初现 (积分 20-40)";
        } else if (points < 60) {
            planet.classList.add('stage-3');
            if(stageName) stageName.innerText = "森林复苏 (积分 40-60)";
        } else if (points < 80) {
            planet.classList.add('stage-4');
            if(stageName) stageName.innerText = "鸟语花香 (积分 60-80)";
        } else {
            planet.classList.add('stage-5');
            if(stageName) stageName.innerText = "生态天堂 (积分 > 80)";
        }
    }

    // 触发上传
    window.triggerUpload = (type) => {
        const input = document.getElementById('file-upload');
        input.click();
        
        input.onchange = (e) => {
            const file = e.target.files[0];
            if (file) {
                // 模拟上传：转为 Base64 存入本地
                const reader = new FileReader();
                reader.onload = (evt) => {
                    const newUpload = {
                        id: Date.now(),
                        username: currentUser.username,
                        image: evt.target.result, // 图片Base64
                        type: type,
                        status: 'pending', // 待审核
                        pointsAwarded: 0,
                        timestamp: new Date().toLocaleString()
                    };
                    uploads.unshift(newUpload);
                    saveData();
                    alert('上传成功，请等待管理员审核！');
                    loadRecycleRecords(); // 刷新列表
                };
                reader.readAsDataURL(file);
            }
        };
    };

    // 加载回收记录
    function loadRecycleRecords() {
        const list = document.getElementById('record-list');
        list.innerHTML = '';
        
        const myUploads = uploads.filter(u => u.username === currentUser.username);
        
        if (myUploads.length === 0) {
            list.innerHTML = '<p style="text-align:center; color:#999; padding:20px;">暂无回收记录</p>';
            return;
        }

        myUploads.forEach(u => {
            let statusText = '';
            let statusClass = '';
            
            if(u.status === 'pending') { statusText = '审核中'; statusClass = 'status-pending'; }
            else if(u.status === 'approved') { statusText = `+${u.pointsAwarded}分`; statusClass = 'status-approved'; }
            else { statusText = '已驳回'; statusClass = 'status-rejected'; }

            const div = document.createElement('div');
            div.className = 'record-item';
            div.innerHTML = `
                <div>
                    <strong>${formatType(u.type)}</strong>
                    <span style="font-size:12px; color:#999; margin-left:10px;">${u.timestamp}</span>
                </div>
                <span class="status-tag ${statusClass}">${statusText}</span>
            `;
            list.appendChild(div);
        });
    }

    function formatType(t) {
        if(t === 'box') return '纸箱回收';
        if(t === 'bag') return '塑料袋回收';
        return '填充物回收';
    }

    // =========================================
    // 3. 答题功能 (Quiz System) - 真正实现
    // =========================================

    // 题库数据
// --- 1. 修改：扩充题库（100道精选题库）---
    const fullQuestionBank = [
        // --- 快递包装类 (1-20) ---
        { id: 1, question: "快递纸箱上的透明胶带属于什么垃圾？", options: ["可回收物", "干垃圾(其他垃圾)", "有害垃圾", "湿垃圾"], correct: 1 },
        { id: 2, question: "以下哪种快递包装材料最难降解？", options: ["瓦楞纸箱", "生物降解袋", "普通塑料胶带", "填充报纸"], correct: 2 },
        { id: 3, question: "收到快递后，纸箱最好的处理方式是？", options: ["直接丢进垃圾桶", "拆平后送至回收点", "用来烧火", "扔在楼道里"], correct: 1 },
        { id: 4, question: "快递内部的气泡膜（捏捏乐）属于什么垃圾？", options: ["干垃圾", "可回收物", "有害垃圾", "湿垃圾"], correct: 1 },
        { id: 5, question: "快递面单（贴有个人信息的纸）撕下来后属于？", options: ["湿垃圾", "干垃圾", "有害垃圾", "可回收物"], correct: 1 },
        { id: 6, question: "由于沾染了油污而无法回收的披萨快递盒属于？", options: ["可回收物", "干垃圾", "湿垃圾", "有害垃圾"], correct: 1 },
        { id: 7, question: "生物降解快递袋在堆肥条件下大概多久能降解？", options: ["1周", "3-6个月", "100年", "永久"], correct: 1 },
        { id: 8, question: "为了减少浪费，寄快递时应优先选择？", options: ["大号箱子", "适度包装", "豪华包装", "多层胶带"], correct: 1 },
        { id: 9, question: "绿色包装的“4R”原则不包括？", options: ["减量化", "再利用", "再循环", "随意丢弃"], correct: 3 },
        { id: 10, question: "我国提倡快递包装“瘦身”，主要是为了？", options: ["节省运费", "减少固体废物产生", "美观", "防盗"], correct: 1 },
        { id: 11, question: "在这个平台上，上传快递盒回收照片主要为了？", options: ["炫耀", "获得积分奖励", "测试相机", "占用内存"], correct: 1 },
        { id: 12, question: "黑色快递袋通常是由什么材料制成的？", options: ["再生塑料", "纯棉", "纸浆", "金属"], correct: 0 },
        { id: 13, question: "泡沫填充物（泡沫球）属于哪一类垃圾？", options: ["湿垃圾", "有害垃圾", "可回收物", "干垃圾"], correct: 2 },
        { id: 14, question: "如果在快递盒内发现了干燥剂，干燥剂属于？", options: ["干垃圾", "湿垃圾", "有害垃圾", "可回收物"], correct: 0 },
        { id: 15, question: "循环快递箱（如漂流箱）的特点是？", options: ["一次性使用", "可以重复使用多次", "只能装衣服", "必须购买"], correct: 1 },
        { id: 16, question: "每回收1吨废纸，可避免砍伐多少棵大树？", options: ["1棵", "5棵", "17棵", "100棵"], correct: 2 },
        { id: 17, question: "胶带在自然界中完全降解需要多久？", options: ["1个月", "1年", "100年以上", "10年"], correct: 2 },
        { id: 18, question: "以下哪种行为是错误的快递回收方式？", options: ["撕掉面单保护隐私", "将纸箱压扁", "连带胶带一起扔进可回收桶", "分类投放"], correct: 2 },
        { id: 19, question: "电子面单相比传统四联单，最大的优势是？", options: ["字更大", "节省纸张且环保", "颜色好看", "不仅防雨还防火"], correct: 1 },
        { id: 20, question: "遇到过度包装的商品，消费者可以？", options: ["默默接受", "向有关部门举报或投诉", "把包装烧了", "再次购买"], correct: 1 },

        // --- 常见垃圾分类 (21-50) ---
        { id: 21, question: "废旧电池（无汞干电池）属于？", options: ["有害垃圾", "干垃圾", "可回收物", "湿垃圾"], correct: 1 },
        { id: 22, question: "充电电池、纽扣电池属于？", options: ["有害垃圾", "干垃圾", "可回收物", "湿垃圾"], correct: 0 },
        { id: 23, question: "喝完的矿泉水瓶属于？", options: ["干垃圾", "湿垃圾", "可回收物", "有害垃圾"], correct: 2 },
        { id: 24, question: "剩菜剩饭、瓜皮果壳属于？", options: ["干垃圾", "湿垃圾(厨余垃圾)", "可回收物", "有害垃圾"], correct: 1 },
        { id: 25, question: "用过的卫生纸、面巾纸属于？", options: ["可回收物", "有害垃圾", "湿垃圾", "干垃圾"], correct: 3 },
        { id: 26, question: "过期的药品及其包装属于？", options: ["干垃圾", "湿垃圾", "有害垃圾", "可回收物"], correct: 2 },
        { id: 27, question: "破碎的玻璃窗、镜子属于？", options: ["可回收物", "干垃圾", "有害垃圾", "湿垃圾"], correct: 0 },
        { id: 28, question: "大骨头（如猪腿骨）属于？", options: ["湿垃圾", "干垃圾", "可回收物", "有害垃圾"], correct: 1 },
        { id: 29, question: "小骨头（如鸡骨头、鱼刺）属于？", options: ["湿垃圾", "干垃圾", "可回收物", "有害垃圾"], correct: 0 },
        { id: 30, question: "旧衣服、旧床单属于？", options: ["干垃圾", "湿垃圾", "可回收物", "有害垃圾"], correct: 2 },
        { id: 31, question: "一次性纸杯（内壁有塑料膜）属于？", options: ["可回收物", "干垃圾", "湿垃圾", "有害垃圾"], correct: 1 },
        { id: 32, question: "奶茶里的珍珠、椰果属于？", options: ["干垃圾", "湿垃圾", "可回收物", "有害垃圾"], correct: 1 },
        { id: 33, question: "喝不完的奶茶杯子本身属于？", options: ["干垃圾", "湿垃圾", "可回收物", "有害垃圾"], correct: 0 },
        { id: 34, question: "废弃的荧光灯管属于？", options: ["可回收物", "干垃圾", "有害垃圾", "湿垃圾"], correct: 2 },
        { id: 35, question: "枯枝落叶属于？", options: ["干垃圾", "湿垃圾", "可回收物", "有害垃圾"], correct: 1 },
        { id: 36, question: "宠物粪便属于？", options: ["湿垃圾", "干垃圾", "有害垃圾", "可回收物"], correct: 1 },
        { id: 37, question: "化妆品瓶子（玻璃或塑料）洗净后属于？", options: ["有害垃圾", "干垃圾", "可回收物", "湿垃圾"], correct: 2 },
        { id: 38, question: "没喝完的药水属于？", options: ["直接倒进下水道", "连瓶子一起扔有害垃圾", "倒进湿垃圾", "喝完它"], correct: 1 },
        { id: 39, question: "废弃的水银温度计属于？", options: ["有害垃圾", "干垃圾", "可回收物", "湿垃圾"], correct: 0 },
        { id: 40, question: "烟蒂（烟头）属于？", options: ["湿垃圾", "干垃圾", "有害垃圾", "可回收物"], correct: 1 },
        { id: 41, question: "坚果壳（如核桃壳）属于？", options: ["湿垃圾", "干垃圾", "可回收物", "有害垃圾"], correct: 1 },
        { id: 42, question: "易拉罐属于？", options: ["有害垃圾", "干垃圾", "可回收物", "湿垃圾"], correct: 2 },
        { id: 43, question: "书本、报纸属于？", options: ["湿垃圾", "干垃圾", "可回收物", "有害垃圾"], correct: 2 },
        { id: 44, question: "坏掉的手机、电脑属于？", options: ["干垃圾", "湿垃圾", "有害垃圾", "可回收物"], correct: 3 },
        { id: 45, question: "一次性塑料袋属于？", options: ["干垃圾", "湿垃圾", "可回收物", "有害垃圾"], correct: 0 },
        { id: 46, question: "榴莲壳、椰子壳属于？", options: ["湿垃圾", "干垃圾", "可回收物", "有害垃圾"], correct: 1 },
        { id: 47, question: "使用过的面膜属于？", options: ["湿垃圾", "干垃圾", "有害垃圾", "可回收物"], correct: 1 },
        { id: 48, question: "X光片、底片属于？", options: ["可回收物", "干垃圾", "有害垃圾", "湿垃圾"], correct: 2 },
        { id: 49, question: "发胶罐、杀虫剂罐属于？", options: ["干垃圾", "湿垃圾", "有害垃圾", "可回收物"], correct: 2 },
        { id: 50, question: "陶瓷碗、陶瓷盘属于？", options: ["可回收物", "干垃圾", "有害垃圾", "湿垃圾"], correct: 1 },

        // --- 环保常识与数据 (51-75) ---
        { id: 51, question: "世界环境日是每年的哪一天？", options: ["3月12日", "4月22日", "6月5日", "9月10日"], correct: 2 },
        { id: 52, question: "地球日是每年的哪一天？", options: ["3月12日", "4月22日", "6月5日", "5月1日"], correct: 1 },
        { id: 53, question: "低碳生活是指生活作息时尽力减少什么的排放？", options: ["二氧化硫", "一氧化碳", "二氧化碳", "氮气"], correct: 2 },
        { id: 54, question: "PM2.5是指大气中直径小于或等于多少的颗粒物？", options: ["2.5纳米", "2.5微米", "2.5毫米", "2.5厘米"], correct: 1 },
        { id: 55, question: "白色污染主要是指什么造成的污染？", options: ["白纸", "塑料", "白烟", "石灰"], correct: 1 },
        { id: 56, question: "温室效应的主要气体是？", options: ["氧气", "氮气", "二氧化碳", "氢气"], correct: 2 },
        { id: 57, question: "可回收物的垃圾桶通常是什么颜色？", options: ["红色", "绿色", "蓝色", "灰色"], correct: 2 },
        { id: 58, question: "有害垃圾的垃圾桶通常是什么颜色？", options: ["红色", "绿色", "蓝色", "灰色"], correct: 0 },
        { id: 59, question: "厨余垃圾（湿垃圾）的垃圾桶通常是什么颜色？", options: ["红色", "绿色(或棕色)", "蓝色", "灰色"], correct: 1 },
        { id: 60, question: "其他垃圾（干垃圾）的垃圾桶通常是什么颜色？", options: ["红色", "绿色", "蓝色", "灰色(或黑色)"], correct: 3 },
        { id: 61, question: "每生产1吨纸，需要消耗多少吨水？", options: ["10吨", "50吨", "100吨", "500吨"], correct: 2 },
        { id: 62, question: "塑料袋埋在地下大概需要多久才能腐烂？", options: ["10年", "50年", "200-400年", "1000年"], correct: 2 },
        { id: 63, question: "我国的植树节是哪一天？", options: ["3月12日", "4月5日", "6月1日", "10月1日"], correct: 0 },
        { id: 64, question: "臭氧层能吸收太阳辐射中的什么？", options: ["红外线", "紫外线", "可见光", "无线电波"], correct: 1 },
        { id: 65, question: "酸雨是指pH值小于多少的雨水？", options: ["7.0", "6.5", "5.6", "4.0"], correct: 2 },
        { id: 66, question: "以下哪种出行方式碳排放量最低？", options: ["私家车", "飞机", "步行或骑行", "公交车"], correct: 2 },
        { id: 67, question: "如果不关水龙头，一天大概会流失多少水？", options: ["1吨", "5吨", "几十公斤", "几百公斤"], correct: 0 },
        { id: 68, question: "垃圾填埋场会产生什么易燃气体？", options: ["氧气", "甲烷", "二氧化碳", "氦气"], correct: 1 },
        { id: 69, question: "回收1个铝罐可以节省多少电力？", options: ["够看电视3小时", "够用手机1分钟", "几乎没有", "够开冰箱1天"], correct: 0 },
        { id: 70, question: "以下哪个标志代表“可循环再生”？", options: ["三个箭头首尾相接", "禁止吸烟", "闪电符号", "骷髅头"], correct: 0 },

        // --- 绿色校园与生活 (76-100) ---
        { id: 71, question: "在食堂吃饭，以下哪种行为是环保的？", options: ["多点菜吃不完倒掉", "使用一次性筷子", "光盘行动", "多拿几张纸巾垫桌子"], correct: 2 },
        { id: 72, question: "离开宿舍时，应该？", options: ["让灯开着防贼", "关掉电源和灯", "开着空调换气", "不关水龙头"], correct: 1 },
        { id: 73, question: "打印文件时，为了节约纸张应该？", options: ["单面打印", "双面打印", "加大字号", "多打几份"], correct: 1 },
        { id: 74, question: "购买饮料时，选择哪种包装最环保？", options: ["玻璃瓶(可回收)", "利乐包", "塑料瓶", "铝罐"], correct: 0 },
        { id: 75, question: "旧书最好的处理方式是？", options: ["当废纸卖", "烧掉", "转赠给同学或捐赠", "撕了折飞机"], correct: 2 },
        { id: 76, question: "去超市购物时，最好？", options: ["购买塑料袋", "自带环保袋", "把东西揣兜里", "用手捧着"], correct: 1 },
        { id: 77, question: "夏天空调温度设置在多少度最节能？", options: ["18度", "20度", "26度", "30度"], correct: 2 },
        { id: 78, question: "洗衣服时，使用什么水洗涤最节能？", options: ["热水", "温水", "冷水", "开水"], correct: 2 },
        { id: 79, question: "以下哪种灯具最节能？", options: ["白炽灯", "LED灯", "荧光灯", "卤素灯"], correct: 1 },
        { id: 80, question: "电脑长时间不用时，应该？", options: ["待机", "睡眠", "关机并切断电源", "屏幕保护"], correct: 2 },
        { id: 81, question: "点外卖时，为了环保应该？", options: ["多要几双筷子", "选择“无需餐具”", "要求多层包装", "点多了倒掉"], correct: 1 },
        { id: 82, question: "洗手涂肥皂时，应该？", options: ["让水一直流", "关掉水龙头", "把水开大点", "用脚堵住水口"], correct: 1 },
        { id: 83, question: "以下哪种纸是不可回收的？", options: ["旧报纸", "纸箱", "污染的卫生纸", "旧书"], correct: 2 },
        { id: 84, question: "废弃的充电宝属于？", options: ["有害垃圾", "可回收物", "干垃圾", "湿垃圾"], correct: 1 },
        { id: 85, question: "装修产生的建筑垃圾应该？", options: ["扔进干垃圾桶", "扔进湿垃圾桶", "定点堆放，专门处理", "扔河里"], correct: 2 },
        { id: 86, question: "以下哪种不是生物质能源？", options: ["秸秆", "沼气", "石油", "木材"], correct: 2 },
        { id: 87, question: "碳中和是指？", options: ["不排放二氧化碳", "排放量与吸收量抵消", "停止工业生产", "只种树不生产"], correct: 1 },
        { id: 88, question: "以下哪种洗涤剂对水污染较小？", options: ["含磷洗衣粉", "无磷洗衣粉", "强力漂白水", "工业强酸"], correct: 1 },
        { id: 89, question: "在校园里看到滴水的水龙头，应该？", options: ["视而不见", "拍照发朋友圈", "随手关紧", "拿桶来接水玩"], correct: 2 },
        { id: 90, question: "大学生参与环保的最直接方式是？", options: ["去南极科考", "做好身边的垃圾分类", "发明永动机", "不呼吸"], correct: 1 },
        { id: 91, question: "“绿水青山就是...”？", options: ["很多钱", "金山银山", "风景画", "旅游景点"], correct: 1 },
        { id: 92, question: "垃圾分类的末端处理方式不包括？", options: ["填埋", "焚烧", "堆肥", "直接倒入海洋"], correct: 3 },
        { id: 93, question: "指甲油瓶子属于？", options: ["有害垃圾", "可回收物", "干垃圾", "湿垃圾"], correct: 0 },
        { id: 94, question: "空的杀虫剂罐在丢弃前应该？", options: ["刺破罐体", "排空余气", "直接丢弃", "用水清洗"], correct: 1 },
        { id: 95, question: "以下哪种物品不适合放入旧衣回收箱？", options: ["洗净的旧外套", "破损严重的内衣裤", "旧床单", "毛绒玩具"], correct: 1 },
        { id: 96, question: "绿色食品标志的图形由什么组成？", options: ["太阳、叶子、蓓蕾", "山、水、云", "树、鸟、人", "星星、月亮"], correct: 0 },
        { id: 97, question: "以下哪种不是可再生能源？", options: ["太阳能", "风能", "煤炭", "水能"], correct: 2 },
        { id: 98, question: "一支圆珠笔芯属于？", options: ["干垃圾", "有害垃圾", "可回收物", "湿垃圾"], correct: 0 },
        { id: 99, question: "我们常说的“白色垃圾”主要指？", options: ["废纸", "不可降解塑料", "建筑废料", "棉花"], correct: 1 },
        { id: 100, question: "保护环境是每个公民的？", options: ["权利", "义务", "爱好", "选择"], correct: 1 }
    ];

    let currentQuizState = {
        active: false,
        questionIndex: 0,
        score: 0
    };

    // --- 2. 修改：开始答题逻辑（包含日期检查 + 随机抽题）---
    window.startQuiz = () => {
        if (!currentUser) { 
            alert("请先登录！"); 
            return; 
        }
        
        // 1. 获取今天的日期字符串 (例如 "2023/12/01")
        const today = new Date().toLocaleDateString();
        
        // 2. 检查用户资料里是否记录了今天的日期
        if (currentUser.lastQuizDate === today) {
            alert("您今天已经完成过答题了，请明天再来挑战！");
            return;
        }

        // 3. 随机逻辑：打乱题库，取前10个
        // sort(() => 0.5 - Math.random()) 是一个简易的数组乱序方法
        const shuffled = [...fullQuestionBank].sort(() => 0.5 - Math.random());
        currentSessionQuestions = shuffled.slice(0, 10);
        
        // 4. 初始化状态
        currentQuizState = {
            active: true,
            questionIndex: 0,
            score: 0
        };

        // 5. 切换界面显示 (隐藏开始页，显示答题页)
        document.getElementById('quiz-start-screen').style.display = 'none';
        document.getElementById('quiz-result-screen').style.display = 'none';
        document.getElementById('quiz-play-screen').style.display = 'block';

        // 6. 渲染第一题
        renderQuestion();
    };

// --- 3. 新增：渲染题目 ---
    function renderQuestion() {
        const qIndex = currentQuizState.questionIndex;
        const qData = currentSessionQuestions[qIndex];

        // 更新进度文字
        document.getElementById('quiz-progress').innerText = `第 ${qIndex + 1} / ${currentSessionQuestions.length} 题`;
        document.getElementById('quiz-score-display').innerText = `本局得分: ${currentQuizState.score}`;

        // 显示题目
        document.getElementById('question-text').innerText = qData.question;

        // 生成选项按钮
        const optsContainer = document.getElementById('options-container');
        optsContainer.innerHTML = ''; // 清空旧选项

        qData.options.forEach((optText, idx) => {
            const btn = document.createElement('button');
            btn.className = 'quiz-option-btn'; // 使用CSS中定义的样式
            btn.innerText = optText;
            btn.onclick = () => selectAnswer(idx, btn); // 绑定点击事件
            optsContainer.appendChild(btn);
        });

        // 重置反馈区域和下一题按钮
        const feedback = document.getElementById('quiz-feedback');
        feedback.style.display = 'none';
        feedback.className = 'quiz-feedback';
        
        const nextBtn = document.getElementById('btn-next-question');
        nextBtn.style.display = 'none';
        nextBtn.innerText = (qIndex === currentSessionQuestions.length - 1) ? "完成挑战" : "下一题";
    }

    // --- 4. 新增：选择答案逻辑 ---
    window.selectAnswer = (selectedIndex, btnElement) => {
        const qIndex = currentQuizState.questionIndex;
        const correctIndex = currentSessionQuestions[qIndex].correct;
        const allBtns = document.querySelectorAll('.quiz-option-btn');
        const feedback = document.getElementById('quiz-feedback');

        // 锁死所有按钮，防止重复点击
        allBtns.forEach(b => {
            b.disabled = true;
            b.classList.add('disabled');
        });

        // 判断对错
        if (selectedIndex === correctIndex) {
            btnElement.classList.add('correct');
            currentQuizState.score += 1; // 答对 +1 分
            feedback.innerText = "回答正确！ +1 积分";
            feedback.classList.add('success');
        } else {
            btnElement.classList.add('wrong');
            // 把正确答案标绿
            allBtns[correctIndex].classList.add('correct');
            feedback.innerText = "回答错误！正确答案是：" + currentSessionQuestions[qIndex].options[correctIndex];
            feedback.classList.add('error');
        }

        // 显示反馈和下一题按钮
        document.getElementById('quiz-score-display').innerText = `本局得分: ${currentQuizState.score}`;
        feedback.style.display = 'block';
        document.getElementById('btn-next-question').style.display = 'inline-block';
    };

    // --- 5. 新增：下一题逻辑 ---
    window.nextQuestion = () => {
        if (currentQuizState.questionIndex < currentSessionQuestions.length - 1) {
            currentQuizState.questionIndex++;
            renderQuestion();
        } else {
            finishQuiz();
        }
    };

    // --- 6. 新增：结算逻辑 (保存日期和积分) ---
    function finishQuiz() {
        // 切换界面
        document.getElementById('quiz-play-screen').style.display = 'none';
        document.getElementById('quiz-result-screen').style.display = 'block';
        document.getElementById('final-score').innerText = currentQuizState.score;

        const userIdx = users.findIndex(u => u.username === currentUser.username);
        if (userIdx !== -1) {
            // 加分
            users[userIdx].points += currentQuizState.score;
            
            // 关键：记录今天的日期，防止重复答题
            users[userIdx].lastQuizDate = new Date().toLocaleDateString();

            // 更新缓存
            currentUser.points = users[userIdx].points;
            currentUser.lastQuizDate = users[userIdx].lastQuizDate;

            saveData();       // 保存到 LocalStorage
            updateGlobalUI(); // 刷新右上角头像和积分显示
        }
    }


    // =========================================
    // 4. 积分商城 & 个人中心
    // =========================================

    window.exchange = (cost, name) => {
        if(currentUser.points >= cost) {
            if(confirm(`确定消耗 ${cost} 积分兑换 [${name}] 吗？`)) {
                const userIdx = users.findIndex(u => u.username === currentUser.username);
                users[userIdx].points -= cost;
                currentUser.points = users[userIdx].points;
                saveData();
                updateGlobalUI();
                alert(`兑换成功！请凭截图到服务站领取 [${name}]。`);
            }
        } else {
            alert("积分不足，快去答题或回收赚积分吧！");
        }
    };

    window.saveProfile = () => {
        if(currentUser) {
            const userIdx = users.findIndex(u => u.username === currentUser.username);
            users[userIdx].info = {
                realname: document.getElementById('p-realname').value,
                gender: document.getElementById('p-gender').value,
                college: document.getElementById('p-college').value,
                phone: document.getElementById('p-phone').value
            };
            currentUser.info = users[userIdx].info; // 更新当前缓存
            saveData();
            alert('个人信息保存成功！');
        }
    };
    
    // 知识Tab切换
    window.switchKnowledge = (tabId) => {
        document.querySelectorAll('.k-content').forEach(c => c.classList.remove('active'));
        document.querySelectorAll('.k-tab').forEach(t => t.classList.remove('active'));
        document.getElementById('k-' + tabId).classList.add('active');
        
        // 按钮高亮联动
        const tabs = document.querySelectorAll('.k-tab');
        if(tabId === 'video') tabs[0].classList.add('active');
        if(tabId === 'policy') tabs[1].classList.add('active');
        if(tabId === 'quiz') tabs[2].classList.add('active');
    };

    // =========================================
    // 5. 管理员功能 (Admin)
    // =========================================

    function loadAdminDashboard() {
        const tbody = document.querySelector('#user-list-table tbody');
        tbody.innerHTML = '';
        
        users.forEach(u => {
            if (u.username === 'admin') return;
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${u.username}</td>
                <td>${u.info.realname || '-'}</td>
                <td>${u.info.college || '-'}</td>
                <td style="font-weight:bold; color:var(--primary-green)">${u.points}</td>
                <td>${getEarthStageName(u.points)}</td>
                <td style="font-size:12px; color:#666;">${u.regDate}</td>
            `;
            tbody.appendChild(tr);
        });
    }

    function getEarthStageName(p) {
        if(p < 20) return '荒芜';
        if(p < 40) return '萌芽';
        if(p < 60) return '复苏';
        if(p < 80) return '繁荣';
        return '天堂';
    }

    function loadAuditList() {
        const grid = document.getElementById('audit-list');
        const emptyMsg = document.getElementById('no-audit-msg');
        grid.innerHTML = '';
        
        const pendingList = uploads.filter(u => u.status === 'pending');
        
        if (pendingList.length === 0) {
            emptyMsg.style.display = 'block';
            return;
        }
        emptyMsg.style.display = 'none';

        pendingList.forEach(item => {
            const card = document.createElement('div');
            card.className = 'audit-card';
            card.innerHTML = `
                <div class="audit-img-box">
                    <img src="${item.image}" alt="回收物">
                </div>
                <div class="audit-info">
                    <div><strong>用户:</strong> ${item.username}</div>
                    <div><strong>类型:</strong> ${formatType(item.type)}</div>
                    <div><strong>时间:</strong> ${item.timestamp}</div>
                </div>
                <div style="display:flex; align-items:center; gap:5px;">
                    <label>奖励积分:</label>
                    <input type="number" class="score-input" id="score-${item.id}" value="10">
                </div>
                <div class="audit-actions">
                    <button class="btn-approve" onclick="auditAction(${item.id}, 'approve')">通过</button>
                    <button class="btn-reject" onclick="auditAction(${item.id}, 'reject')">驳回</button>
                </div>
            `;
            grid.appendChild(card);
        });
    }

    window.auditAction = (id, action) => {
        const itemIndex = uploads.findIndex(u => u.id === id);
        if (itemIndex === -1) return;
        
        const item = uploads[itemIndex];
        
        if (action === 'approve') {
            const scoreInput = document.getElementById(`score-${id}`);
            const points = parseInt(scoreInput.value) || 0;
            
            item.status = 'approved';
            item.pointsAwarded = points;
            
            // 给用户加分
            const userIdx = users.findIndex(u => u.username === item.username);
            if (userIdx !== -1) {
                users[userIdx].points += points;
            }
        } else {
            item.status = 'rejected';
        }
        
        saveData();
        loadAuditList(); // 刷新列表
        alert('操作成功！');
    };

});
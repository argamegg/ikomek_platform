import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import { session } from "../lib/session";

const resources = {
  en: {
    translation: {
      brand: {
        name: "iKOMEK 109",
        tagline: "Smart city platform",
      },
      common: {
        loading: "Loading",
        retry: "Retry",
        save: "Save",
        cancel: "Cancel",
        create: "Create",
        update: "Update",
        send: "Send",
        logout: "Log out",
        login: "Sign in",
        register: "Create account",
        profile: "Profile",
        dashboard: "Dashboard",
        map: "Map",
        requests: "Requests",
        news: "News",
        operator: "Operations",
        admin: "Admin",
        details: "Details",
        chat: "Chat",
        language: "Language",
        search: "Search",
        searchPlaceholder: "Search by title, address or request ID",
        submitRequest: "New request",
        empty: "No data yet",
        public: "Public",
        private: "Private",
      },
      nav: {
        home: "Home",
        dashboard: "Resident dashboard",
        requests: "My requests",
        newRequest: "Submit issue",
        news: "News & alerts",
        map: "City map",
        profile: "Profile",
        operator: "Operator board",
        admin: "Admin studio",
        auth: "Authentication",
      },
      shell: {
        status: "Shared backend connection",
        connected: "Live against the existing FastAPI platform",
        guest: "Guest mode",
        welcome: "One platform for residents, operators, and the city team.",
      },
      home: {
        badge: "Shared mobile + web platform",
        title: "A modern desktop command center for the iKOMEK 109 ecosystem.",
        description:
          "Residents, operators, and administrators work from the same backend, the same requests, the same chat history, and the same city data.",
        primary: "Create a request",
        secondary: "Explore the live map",
        stats: {
          requests: "Public issues on the map",
          alerts: "Active city alerts",
          categories: "Service categories",
        },
        overview: {
          eyebrow: "Platform overview",
          title: "One platform, multiple city stories, one consistent response model.",
          description:
            "This isn’t just a dashboard. It’s a city-facing digital product layer built around the same backend logic used by residents, operators, and administrators.",
          narrative:
            "The system combines issue intake, map visibility, alert publishing, and operational follow-through into one connected flow instead of isolated screens.",
          visibleIssues: "Visible issues in the shared city stream",
          cardOneEyebrow: "One data source",
          cardOneTitle: "One backend powers every channel.",
          cardOneBody:
            "The web experience, mobile app, operators, and city admins all work on the same requests, statuses, and content stream.",
          cardTwoEyebrow: "Live operations",
          cardTwoTitle: "Fast response across the whole lifecycle.",
          cardTwoBody:
            "From the first citizen report to the final resolution, updates move through a shared queue instead of disconnected interfaces.",
        },
        statsSection: {
          eyebrow: "Shared system metrics",
          title: "Signals that feel alive as soon as the page enters view.",
        },
        preview: {
          signalLabel: "Shared city signal",
          activeMapPoints: "{{count}} active map points",
          sharedQueue: "Web and mobile read from the same service queue and city content stream.",
          categories: "Categories",
          alerts: "Alerts",
          issueStream: "Shared live issue stream",
          disruptions: "Priority notices and disruptions",
          syncedCategories: "Service categories synced with backend",
          liveIssuePulse: "Live issue pulse",
          mapPoints: "{{count}} map points",
          alertsCount: "{{count}} alerts",
          selectedIssue: "Selected issue",
        },
        newsPreview: {
          eyebrow: "News and alerts",
          title: "Stay aware of service changes, closures, and important city updates.",
          description:
            "This feed helps residents quickly understand what changed, where it matters, and which updates may affect daily life in the city.",
          locationFallback: "Astana",
        },
        alertsStory: {
          eyebrow: "Public awareness",
          title: "News and alerts stay close to action.",
          body: "Residents can track disruptions, city notices, and issue hotspots in the same product surface where requests are created.",
          landingMetric: "Editorial updates and public alerts surfaced on the landing page",
        },
        severity: {
          critical: "Critical",
          warning: "Warning",
          information: "Information",
          high: "High",
          medium: "Medium",
          low: "Low",
          unknown: "Update",
        },
        categoriesSection: {
          eyebrow: "What you can report",
          title: "Choose the city issue that best matches what needs to be fixed.",
          description:
            "Each category helps residents understand what can be reported and what city services usually resolve through iKOMEK 109.",
          modal: {
            close: "Close category details",
            problemType: "Problem type",
            detailsTitle: "What gets resolved",
            examplesTitle: "Examples",
            whenToUseTitle: "When to use this category",
          },
          labels: {
            electricity: "Electricity",
            water: "Water Supply",
            heating: "Heating",
            public_order: "Public Order",
            sewage: "Sewage",
            waste: "Waste",
            roads: "Roads",
            other: "Other",
          },
          cards: {
            electricity: {
              description: "Lighting outages, power cuts, damaged lines, and electrical failures.",
              details:
                "Use this category for outages, dangerous exposed cables, damaged transformers, or broken street lighting that requires an electrical response.",
              example: "Streetlights, cable faults, transformer issues.",
              whenToUse:
                "Choose this category if the main issue is power, lighting, or electrical infrastructure.",
            },
            water: {
              description: "No water, weak pressure, leaks, and supply interruptions.",
              details:
                "Use this category when homes, buildings, or outdoor infrastructure face water supply interruptions, visible leaks, or unstable pressure.",
              example: "Building supply issues, burst pipes, emergency leaks.",
              whenToUse:
                "Choose this category if the main problem is drinking water supply, pressure, or leakage.",
            },
            heating: {
              description: "Heating problems in homes, cold radiators, and service disruptions.",
              details:
                "Use this category for cold apartments, unstable heating service, radiator problems, or other heating-system failures during the season.",
              example: "No heat, uneven heating, recurring interruptions.",
              whenToUse:
                "Choose this category if the issue affects indoor heat supply or building heating systems.",
            },
            public_order: {
              description: "Public disturbances, excessive noise, and unsafe or illegal activity.",
              details:
                "Use this category for recurring disturbances in shared spaces, public safety concerns, or visible behavior that requires city attention.",
              example: "Night noise, disorder, conflicts in shared public spaces.",
              whenToUse:
                "Choose this category if the issue is about safety, noise, or order in public areas.",
            },
            sewage: {
              description: "Sewer blockages, bad odors, flooding, and emergency failures.",
              details:
                "Use this category when wastewater systems overflow, drains are blocked, or strong sewage odors indicate a network problem.",
              example: "Blocked drains, overflowing sewage, strong smells near buildings.",
              whenToUse:
                "Choose this category if the issue is related to sewer drainage, overflow, or sanitation risks.",
            },
            waste: {
              description: "Overflowing bins, missed collection, and waste-related sanitation issues.",
              details:
                "Use this category for household waste collection problems, overflowing containers, or sanitation issues caused by delayed removal.",
              example: "Full containers, illegal dumping, delayed cleanup.",
              whenToUse:
                "Choose this category if the main issue is garbage collection, overflowing bins, or illegal dumping.",
            },
            roads: {
              description: "Potholes, damaged roads, unsafe surfaces, and marking problems.",
              details:
                "Use this category for damaged road surfaces, unsafe pavement conditions, broken curbs, or missing and faded markings.",
              example: "Road damage, broken curbs, faded lane markings.",
              whenToUse:
                "Choose this category if transport safety or road condition is the main problem.",
            },
            other: {
              description: "Other city problems that do not fit the main reporting categories.",
              details:
                "Use this category when the issue still needs city attention but does not clearly belong to electricity, water, roads, waste, or another main service group.",
              example: "Use this if your issue needs attention but belongs elsewhere.",
              whenToUse:
                "Choose this category if none of the main categories describe your issue well enough.",
            },
          },
        },
        mapPreview: {
          eyebrow: "Map preview",
          title: "A wide city map block with premium framing instead of a plain admin rectangle.",
          description:
            "Explore issue concentration, status distribution, and the latest selected request in a section that feels like a product showcase.",
        },
        how: {
          eyebrow: "How it works",
          title: "Each stage reveals progressively so the whole journey reads like a single flow.",
          stepOneTitle: "Citizen reports the issue",
          stepOneBody:
            "A resident submits a request with category, location, photos, and details from mobile or web.",
          stepTwoTitle: "Operators triage and assign",
          stepTwoBody:
            "Call center staff review incoming reports, update status, and coordinate the proper response path.",
          stepThreeTitle: "City services resolve",
          stepThreeBody:
            "The request progresses through shared statuses with comments, notes, and supporting communication.",
          stepFourTitle: "Resident sees the result",
          stepFourBody:
            "The same person who reported the issue can track updates and close the loop with confidence.",
        },
        cta: {
          badge: "Create your next city request",
          title: "Move from awareness to action in one click.",
          description:
            "The landing page now tells the story. The next step is to turn that attention into a real request inside the shared iKOMEK workflow.",
          button: "Create request",
          trust: "Shared backend, synchronized statuses, one request lifecycle.",
        },
        requestStatus: {
          pending: "Pending",
          in_progress: "In progress",
          closed: "Closed",
          open: "Open",
          resolved: "Resolved",
          rejected: "Rejected",
        },
        sections: {
          pulse: "City pulse",
          pulseDescription: "Latest alerts and editorial updates from the shared news stream.",
          categories: "Popular categories",
          categoriesDescription: "Shared request taxonomy pulled from the existing backend.",
          journey: "How the platform works",
        },
      },
      auth: {
        loginTab: "Sign in",
        registerTab: "Register",
        recoverTab: "Recover access",
        login: {
          eyebrow: "Login",
          title: "Sign in to your existing iKOMEK account",
          subtitle: "Web and mobile applications use one authentication flow, profiles, requests, and chat history.",
        },
        register: {
          eyebrow: "Registration",
          title: "Create an account",
          subtitle: "Welcome! Please fill in your details to register.",
        },
        recovery: {
          eyebrow: "Recovery",
          title: "Recover access",
          subtitle: "Enter your details to restore access to your account.",
        },
        verification: {
          eyebrow: "Verification",
          title: "Verify your email",
          subtitle: "Enter the one-time code sent to your email to activate your iKOMEK account.",
          titleText: "Verification code",
          instructions: "Enter the 6-digit code we sent to your email address.",
          sentTo: "We sent a verification code to {{email}}.",
          code: "Verification code",
          codePlaceholder: "Enter 6-digit code",
          expiresInMinutes: "The code expires in {{minutes}} min.",
          confirm: "Verify email",
          resend: "Resend code",
          resendIn: "Resend in {{seconds}}s",
          editEmail: "Edit email",
          codeSent: "We sent a verification code to your email.",
          resent: "A new verification code was sent.",
          verified: "Email verified successfully.",
          loginBlocked: "Your account is not verified yet. Enter the code from your email to continue.",
        },
        feedback: {
          loginSuccess: "Signed in successfully",
        },
        recoverNotice: {
          title: "Password recovery is not available yet",
          body: "The shared FastAPI backend does not expose a password recovery flow at the moment.",
          hint: "You can use a demo account or create a new account from this page.",
        },
        fields: {
          name: "Full name",
          email: "Email",
          password: "Password",
          phone: "Phone",
          language: "Preferred language",
        },
      },
      dashboard: {
        title: "Resident command center",
        description: "Track issue progress, saved places, alerts, and personal activity in one place.",
        cards: {
          total: "All requests",
          active: "Active now",
          pending: "Awaiting action",
          saved: "Saved places",
        },
      },
      requests: {
        title: "Request management",
        description: "Everything around the issue lifecycle in a desktop-first experience.",
        filtersAll: "All",
        filtersPending: "Pending",
        filtersProgress: "In progress",
        filtersClosed: "Closed",
        timeline: "Status timeline",
        attachments: "Attachments",
        empty: "No requests matched this filter.",
      },
      newRequest: {
        title: "Submit a new city issue",
        description: "Use saved places, geo coordinates, categories, reasons, and attachments from the shared platform.",
        address: "Address",
        place: "Place",
        category: "Category",
        reason: "Reason",
        descriptionLabel: "Description",
        attachments: "Attachments",
        geolocate: "Use my location",
        summary: "Submission summary",
      },
      requestDetails: {
        overview: "Overview",
        history: "History",
        messages: "Messages",
      },
      chat: {
        title: "Request conversation",
        description: "Message history stays synchronized with the mobile application.",
        placeholder: "Type your message",
      },
      news: {
        title: "City news and alerts",
        description: "A polished editorial and alert experience for the existing city content stream.",
      },
      map: {
        title: "Live city map",
        description: "Explore clustered public issues, heat zones, and district activity.",
        all: "All requests",
        mine: "My requests",
        heatmap: "Heatmap",
      },
      profile: {
        title: "Profile & saved places",
        addLocation: "Add place",
        notifications: "Notifications",
      },
      operator: {
        title: "Operator workspace",
        description: "Prioritize the queue, review details, and update statuses without leaving the shared system.",
        update: "Update status",
      },
      admin: {
        title: "Admin studio",
        description: "Monitor request metrics and publish city updates with a product-grade editorial workflow.",
        publish: "Publish news",
      },
      emptyStates: {
        genericTitle: "Nothing to show yet",
        genericDescription: "Once the backend returns records, they’ll appear here automatically.",
      },
    },
  },
  ru: {
    translation: {
      brand: { name: "iKOMEK 109", tagline: "Smart city платформа" },
      common: {
        loading: "Загрузка",
        retry: "Повторить",
        save: "Сохранить",
        cancel: "Отмена",
        create: "Создать",
        update: "Обновить",
        send: "Отправить",
        logout: "Выйти",
        login: "Войти",
        register: "Создать аккаунт",
        profile: "Профиль",
        dashboard: "Кабинет",
        map: "Карта",
        requests: "Заявки",
        news: "Новости",
        operator: "Операции",
        admin: "Админ",
        details: "Детали",
        chat: "Чат",
        language: "Язык",
        search: "Поиск",
        searchPlaceholder: "Поиск по заголовку, адресу или ID",
        submitRequest: "Новая заявка",
        empty: "Пока нет данных",
        public: "Публично",
        private: "Приватно",
      },
      nav: {
        home: "Главная",
        dashboard: "Кабинет жителя",
        requests: "Мои заявки",
        newRequest: "Подать проблему",
        news: "Новости и алерты",
        map: "Карта города",
        profile: "Профиль",
        operator: "Панель оператора",
        admin: "Админ-студия",
        auth: "Вход",
      },
      shell: {
        status: "Подключение к shared backend",
        connected: "Работает с существующей FastAPI платформой",
        guest: "Гостевой режим",
        welcome: "Одна платформа для жителей, операторов и администрации.",
      },
      home: {
        badge: "Единая mobile + web платформа",
        title: "Современный desktop command center для экосистемы iKOMEK 109.",
        description:
          "Жители, операторы и администрация работают с одним backend, одними заявками, одним чатом и одними городскими данными.",
        primary: "Создать заявку",
        secondary: "Открыть карту",
        stats: {
          requests: "Публичных проблем на карте",
          alerts: "Активных алертов",
          categories: "Категорий услуг",
        },
        overview: {
          eyebrow: "Обзор платформы",
          title: "Одна платформа, несколько городских сценариев и единая модель реагирования.",
          description:
            "Это не просто dashboard. Это городская цифровая продуктовая оболочка, построенная вокруг той же backend-логики, которой пользуются жители, операторы и администрация.",
          narrative:
            "Система объединяет прием заявок, видимость на карте, публикацию алертов и операционное сопровождение в единый связанный поток вместо разрозненных экранов.",
          visibleIssues: "Видимые проблемы в общем городском потоке",
          cardOneEyebrow: "Единый источник данных",
          cardOneTitle: "Один backend обслуживает все каналы.",
          cardOneBody:
            "Веб-интерфейс, мобильное приложение, операторы и городские администраторы работают с одними и теми же заявками, статусами и контентным потоком.",
          cardTwoEyebrow: "Живые операции",
          cardTwoTitle: "Быстрая реакция на всем жизненном цикле.",
          cardTwoBody:
            "От первого обращения жителя до финального решения обновления проходят через общую очередь, а не через разрозненные интерфейсы.",
        },
        statsSection: {
          eyebrow: "Метрики общей системы",
          title: "Сигналы, которые выглядят живыми сразу при появлении секции на экране.",
        },
        preview: {
          signalLabel: "Городской сигнал",
          activeMapPoints: "{{count}} активных точек на карте",
          sharedQueue:
            "Веб и мобильное приложение работают с одной очередью заявок и одним городским контент-потоком.",
          categories: "Категории",
          alerts: "Алерты",
          issueStream: "Общий поток городских заявок",
          disruptions: "Приоритетные оповещения и перебои",
          syncedCategories: "Категории услуг синхронизированы с backend",
          liveIssuePulse: "Пульс городских заявок",
          mapPoints: "{{count}} точек на карте",
          alertsCount: "{{count}} алертов",
          selectedIssue: "Выбранная проблема",
        },
        newsPreview: {
          eyebrow: "Новости и алерты",
          title: "Следите за изменениями в городе, перекрытиями и важными обновлениями.",
          description:
            "Эта лента помогает жителям быстро понять, что изменилось, где это происходит и какие обновления могут повлиять на повседневную жизнь.",
          locationFallback: "Астана",
        },
        alertsStory: {
          eyebrow: "Публичная видимость",
          title: "Новости и алерты рядом с действием.",
          body: "Жители могут видеть перебои, городские объявления и горячие точки проблем в том же интерфейсе, где создаются заявки.",
          landingMetric: "Редакционные обновления и публичные алерты, показанные на главной странице",
        },
        severity: {
          critical: "Критический",
          warning: "Предупреждение",
          information: "Информация",
          high: "Высокий",
          medium: "Средний",
          low: "Низкий",
          unknown: "Обновление",
        },
        categoriesSection: {
          eyebrow: "Какие проблемы можно сообщить",
          title: "Выберите тип городской проблемы, чтобы быстрее направить обращение в нужную службу.",
          description:
            "Каждая категория подсказывает, какие обращения можно отправить через iKOMEK 109 и что обычно решается по этому направлению.",
          modal: {
            close: "Закрыть детали категории",
            problemType: "Тип проблемы",
            detailsTitle: "Что обычно исправляется",
            examplesTitle: "Примеры",
            whenToUseTitle: "Когда выбирать эту категорию",
          },
          labels: {
            electricity: "Электричество",
            water: "Водоснабжение",
            heating: "Отопление",
            public_order: "Нарушение порядка",
            sewage: "Канализация",
            waste: "Мусор",
            roads: "Дороги",
            other: "Другое",
          },
          cards: {
            electricity: {
              description: "Проблемы с освещением, перебои электричества, аварии на линиях.",
              details:
                "Используйте эту категорию для отключений, опасных открытых кабелей, поврежденных трансформаторов и неработающего уличного освещения.",
              example: "Например: неработающие фонари, кабели, трансформаторы.",
              whenToUse:
                "Выбирайте эту категорию, если основная проблема связана с электроснабжением, светом или электрической инфраструктурой.",
            },
            water: {
              description: "Отсутствие воды, слабое давление, утечки и аварии.",
              details:
                "Используйте эту категорию, когда в доме, здании или на городской инфраструктуре есть перебои с водоснабжением, заметные протечки или нестабильное давление.",
              example: "Например: прорывы труб, перебои подачи, аварийные утечки.",
              whenToUse:
                "Выбирайте эту категорию, если проблема касается подачи воды, давления или утечки.",
            },
            heating: {
              description: "Проблемы с отоплением в домах, холодные батареи, перебои.",
              details:
                "Используйте эту категорию для холодных квартир, нестабильной подачи тепла, проблем с радиаторами и других сбоев отопительной системы.",
              example: "Например: нет тепла, неравномерный прогрев, частые отключения.",
              whenToUse:
                "Выбирайте эту категорию, если проблема связана с подачей тепла или системой отопления здания.",
            },
            public_order: {
              description: "Нарушения порядка, шум, незаконные действия в общественных местах.",
              details:
                "Используйте эту категорию для повторяющихся нарушений в общих пространствах, угроз общественной безопасности и поведения, требующего внимания города.",
              example: "Например: ночной шум, конфликты, опасное поведение.",
              whenToUse:
                "Выбирайте эту категорию, если проблема связана с безопасностью, шумом или порядком в общественных местах.",
            },
            sewage: {
              description: "Засоры канализации, неприятные запахи, аварии.",
              details:
                "Используйте эту категорию, когда канализация переполняется, стоки плохо уходят или сильный запах указывает на проблему в сети.",
              example: "Например: переполнения, засоры, запах возле дома.",
              whenToUse:
                "Выбирайте эту категорию, если проблема связана с канализацией, переливом или санитарными рисками.",
            },
            waste: {
              description: "Переполненные контейнеры, несвоевременный вывоз мусора.",
              details:
                "Используйте эту категорию для проблем с вывозом бытовых отходов, переполненных контейнеров и санитарных последствий из-за задержки уборки.",
              example: "Например: завалы, стихийные свалки, задержка уборки.",
              whenToUse:
                "Выбирайте эту категорию, если основная проблема связана с мусором, вывозом отходов или незаконным сбросом.",
            },
            roads: {
              description: "Ямы, повреждения дорог, проблемы с разметкой.",
              details:
                "Используйте эту категорию для разрушенного дорожного покрытия, опасных участков, поврежденных бордюров и отсутствующей или стертой разметки.",
              example: "Например: разбитое покрытие, бордюры, стертая разметка.",
              whenToUse:
                "Выбирайте эту категорию, если ключевая проблема связана с состоянием дороги или безопасностью движения.",
            },
            other: {
              description: "Другие городские проблемы, не попавшие в основные категории.",
              details:
                "Используйте эту категорию, если проблема требует внимания города, но ее нельзя уверенно отнести к электричеству, воде, дорогам, мусору или другой основной группе.",
              example: "Используйте, если ситуация требует внимания, но не подходит выше.",
              whenToUse:
                "Выбирайте эту категорию, если ни одна из основных категорий не описывает проблему достаточно точно.",
            },
          },
        },
        mapPreview: {
          eyebrow: "Превью карты",
          title: "Широкий городской блок карты с премиальной подачей вместо обычного админского прямоугольника.",
          description:
            "Изучайте концентрацию проблем, распределение статусов и последнюю выбранную заявку в секции, которая ощущается как продуктовая витрина.",
        },
        how: {
          eyebrow: "Как это работает",
          title: "Каждый этап раскрывается постепенно, чтобы весь путь читался как единый поток.",
          stepOneTitle: "Житель сообщает о проблеме",
          stepOneBody:
            "Житель отправляет заявку с категорией, локацией, фотографиями и деталями через мобильное приложение или веб.",
          stepTwoTitle: "Операторы обрабатывают и назначают",
          stepTwoBody:
            "Сотрудники call-центра просматривают входящие заявки, обновляют статус и координируют правильный путь реагирования.",
          stepThreeTitle: "Городские службы решают",
          stepThreeBody:
            "Заявка проходит через общие статусы с комментариями, заметками и сопроводительной коммуникацией.",
          stepFourTitle: "Житель видит результат",
          stepFourBody:
            "Тот же человек, который сообщил о проблеме, может отслеживать обновления и уверенно закрыть цикл.",
        },
        cta: {
          badge: "Создайте следующую городскую заявку",
          title: "Переходите от осведомленности к действию в один клик.",
          description:
            "Главная страница теперь рассказывает историю. Следующий шаг — превратить это внимание в реальную заявку внутри общего workflow iKOMEK.",
          button: "Создать заявку",
          trust: "Общий backend, синхронизированные статусы и единый жизненный цикл заявки.",
        },
        requestStatus: {
          pending: "Ожидает",
          in_progress: "В работе",
          closed: "Закрыта",
          open: "Открыта",
          resolved: "Решена",
          rejected: "Отклонена",
        },
        sections: {
          pulse: "Пульс города",
          pulseDescription: "Последние алерты и новости из общего контентного потока.",
          categories: "Популярные категории",
          categoriesDescription: "Общая таксономия заявок из существующего backend.",
          journey: "Как работает платформа",
        },
      },
      auth: {
        loginTab: "Вход",
        registerTab: "Регистрация",
        recoverTab: "Восстановление",
        login: {
          eyebrow: "Вход",
          title: "Войдите в существующий аккаунт iKOMEK",
          subtitle: "Веб и мобильное приложение используют одну аутентификацию, профили, заявки и историю чатов.",
        },
        register: {
          eyebrow: "Регистрация",
          title: "Создание аккаунта",
          subtitle: "Добро пожаловать! Пожалуйста, заполните данные для регистрации.",
        },
        recovery: {
          eyebrow: "Восстановление",
          title: "Восстановление доступа",
          subtitle: "Введите данные, чтобы восстановить доступ к вашему аккаунту.",
        },
        verification: {
          eyebrow: "Подтверждение",
          title: "Подтвердите email",
          subtitle: "Введите одноразовый код из письма, чтобы активировать аккаунт iKOMEK.",
          titleText: "Код подтверждения",
          instructions: "Введите 6-значный код, который мы отправили на ваш email.",
          sentTo: "Мы отправили код подтверждения на {{email}}.",
          code: "Код подтверждения",
          codePlaceholder: "Введите 6-значный код",
          expiresInMinutes: "Код действует {{minutes}} мин.",
          confirm: "Подтвердить email",
          resend: "Отправить код повторно",
          resendIn: "Повторно через {{seconds}}с",
          editEmail: "Изменить email",
          codeSent: "Мы отправили код подтверждения на ваш email.",
          resent: "Новый код подтверждения отправлен.",
          verified: "Email успешно подтвержден.",
          loginBlocked: "Ваш аккаунт еще не подтвержден. Введите код из письма, чтобы продолжить.",
        },
        feedback: {
          loginSuccess: "Вход выполнен",
        },
        recoverNotice: {
          title: "Восстановление пароля пока недоступно",
          body: "Общий FastAPI backend сейчас не предоставляет сценарий восстановления пароля.",
          hint: "Вы можете использовать демо-аккаунт или создать новый аккаунт на этой странице.",
        },
        fields: {
          name: "Полное имя",
          email: "Email",
          password: "Пароль",
          phone: "Телефон",
          language: "Предпочитаемый язык",
        },
      },
      dashboard: {
        title: "Центр управления жителя",
        description: "Следите за заявками, сохраненными адресами, алертами и личной активностью в одном месте.",
        cards: {
          total: "Все заявки",
          active: "Активные",
          pending: "Ожидают",
          saved: "Сохраненные места",
        },
      },
      requests: {
        title: "Управление заявками",
        description: "Полный desktop-first опыт вокруг жизненного цикла обращения.",
        filtersAll: "Все",
        filtersPending: "Ожидают",
        filtersProgress: "В работе",
        filtersClosed: "Закрыты",
        timeline: "Таймлайн статусов",
        attachments: "Вложения",
        empty: "По этому фильтру ничего не найдено.",
      },
      newRequest: {
        title: "Подать новую городскую проблему",
        description:
          "Используйте сохраненные места, координаты, категории, причины и вложения из общей платформы.",
        address: "Адрес",
        place: "Место",
        category: "Категория",
        reason: "Причина",
        descriptionLabel: "Описание",
        attachments: "Вложения",
        geolocate: "Использовать мою локацию",
        summary: "Сводка перед отправкой",
      },
      requestDetails: {
        overview: "Обзор",
        history: "История",
        messages: "Сообщения",
      },
      chat: {
        title: "Диалог по заявке",
        description: "История сообщений остается синхронизированной с мобильным приложением.",
        placeholder: "Введите сообщение",
      },
      news: {
        title: "Городские новости и оповещения",
        description: "Аккуратный редакционный интерфейс для существующего городского контент-потока.",
      },
      map: {
        title: "Живая карта города",
        description: "Исследуйте кластеризованные публичные заявки, тепловые зоны и активность районов.",
        all: "Все заявки",
        mine: "Мои заявки",
        heatmap: "Тепловая карта",
      },
      profile: {
        title: "Профиль и сохраненные адреса",
        addLocation: "Добавить место",
        notifications: "Уведомления",
      },
      operator: {
        title: "Рабочее место оператора",
        description: "Приоритизируйте очередь, проверяйте детали и обновляйте статусы внутри общей системы.",
        update: "Обновить статус",
      },
      admin: {
        title: "Админ-студия",
        description: "Контролируйте метрики и публикуйте городские обновления в аккуратном workflow.",
        publish: "Опубликовать новость",
      },
      emptyStates: {
        genericTitle: "Пока нечего показывать",
        genericDescription: "Как только backend вернет записи, они автоматически появятся здесь.",
      },
    },
  },
  kz: {
    translation: {
      brand: { name: "iKOMEK 109", tagline: "Smart city платформасы" },
      common: {
        loading: "Жүктелуде",
        retry: "Қайталау",
        save: "Сақтау",
        cancel: "Бас тарту",
        create: "Құру",
        update: "Жаңарту",
        send: "Жіберу",
        logout: "Шығу",
        login: "Кіру",
        register: "Тіркелу",
        profile: "Профиль",
        dashboard: "Кабинет",
        map: "Карта",
        requests: "Өтінімдер",
        news: "Жаңалықтар",
        operator: "Операциялар",
        admin: "Әкімші",
        details: "Деректер",
        chat: "Чат",
        language: "Тіл",
        search: "Іздеу",
        searchPlaceholder: "Тақырып, мекенжай немесе ID бойынша іздеу",
        submitRequest: "Жаңа өтінім",
        empty: "Әзірге дерек жоқ",
        public: "Ашық",
        private: "Жеке",
      },
      nav: {
        home: "Басты бет",
        dashboard: "Тұрғын кабинеті",
        requests: "Менің өтінімдерім",
        newRequest: "Мәселе жіберу",
        news: "Жаңалықтар мен ескертулер",
        map: "Қала картасы",
        profile: "Профиль",
        operator: "Оператор панелі",
        admin: "Әкімші студиясы",
        auth: "Кіру",
      },
      shell: {
        status: "Ортақ backend байланысы",
        connected: "Қолданыстағы FastAPI платформасымен жұмыс істейді",
        guest: "Қонақ режимі",
        welcome: "Тұрғындарға, операторларға және әкімдікке арналған бір платформа.",
      },
      home: {
        badge: "Біртұтас mobile + web платформа",
        title: "iKOMEK 109 экожүйесіне арналған заманауи desktop command center.",
        description:
          "Тұрғындар, операторлар және әкімшілік бір backend, бір өтінімдер, бір чат тарихы және бір қала деректерімен жұмыс істейді.",
        primary: "Өтінім құру",
        secondary: "Картаны ашу",
        stats: {
          requests: "Картадағы ашық мәселелер",
          alerts: "Белсенді ескертулер",
          categories: "Қызмет санаттары",
        },
        overview: {
          eyebrow: "Платформаға шолу",
          title: "Бір платформа, бірнеше қалалық сценарий және бірыңғай әрекет ету моделі.",
          description:
            "Бұл жай ғана dashboard емес. Бұл тұрғындар, операторлар және әкімшілік қолданатын сол backend логикасына құрылған қалалық цифрлық өнім қабаты.",
          narrative:
            "Жүйе өтінім қабылдауды, картадағы көрінуді, ескертулер жариялауды және операциялық сүйемелдеуді бөлек экрандар емес, біртұтас ағымға біріктіреді.",
          visibleIssues: "Ортақ қала ағынындағы көрінетін мәселелер",
          cardOneEyebrow: "Бірыңғай дерек көзі",
          cardOneTitle: "Бір backend барлық арнаны қамтамасыз етеді.",
          cardOneBody:
            "Веб тәжірибе, мобильді қосымша, операторлар және қала әкімшілері бірдей өтінімдермен, статустармен және контент ағынымен жұмыс істейді.",
          cardTwoEyebrow: "Тірі операциялар",
          cardTwoTitle: "Барлық lifecycle бойында жылдам әрекет.",
          cardTwoBody:
            "Тұрғынның алғашқы хабарламасынан соңғы шешімге дейін жаңартулар бөлек интерфейстермен емес, ортақ кезек арқылы өтеді.",
        },
        statsSection: {
          eyebrow: "Ортақ жүйе метрикалары",
          title: "Бөлім экранға шыққан сәттен бастап тірі сезілетін сигналдар.",
        },
        preview: {
          signalLabel: "Ортақ қала сигналы",
          activeMapPoints: "Картадағы белсенді нүктелер: {{count}}",
          sharedQueue:
            "Веб пен мобильді қосымша бір өтінім кезегін және бір қалалық контент ағынын пайдаланады.",
          categories: "Санаттар",
          alerts: "Ескертулер",
          issueStream: "Қалалық өтінімдердің ортақ ағыны",
          disruptions: "Басым хабарламалар мен үзілістер",
          syncedCategories: "Қызмет санаттары backend-пен синхрондалған",
          liveIssuePulse: "Қалалық өтінімдер пульсі",
          mapPoints: "Карта нүктелері: {{count}}",
          alertsCount: "Ескертулер: {{count}}",
          selectedIssue: "Таңдалған мәселе",
        },
        newsPreview: {
          eyebrow: "Жаңалықтар мен ескертулер",
          title: "Қалалық өзгерістерді, жабылуларды және маңызды жаңартуларды бақылаңыз.",
          description:
            "Бұл таспа тұрғындарға не өзгергенін, оның қай жерде болып жатқанын және күнделікті өмірге қалай әсер етуі мүмкін екенін тез түсінуге көмектеседі.",
          locationFallback: "Астана",
        },
        alertsStory: {
          eyebrow: "Қоғамдық көріну",
          title: "Жаңалықтар мен ескертулер әрекетке жақын.",
          body: "Тұрғындар үзілістерді, қалалық хабарландыруларды және мәселе ошақтарын өтінім жасалатын сол интерфейстен көре алады.",
          landingMetric: "Басты бетте көрсетілетін редакциялық жаңартулар мен қоғамдық ескертулер",
        },
        severity: {
          critical: "Сындарлы",
          warning: "Ескерту",
          information: "Ақпарат",
          high: "Жоғары",
          medium: "Орташа",
          low: "Төмен",
          unknown: "Жаңарту",
        },
        categoriesSection: {
          eyebrow: "Қандай мәселелерді хабарлауға болады",
          title: "Қай қызметке тезірек бағыттау үшін қалалық мәселе түрін таңдаңыз.",
          description:
            "Әр санат iKOMEK 109 арқылы қандай өтінім жіберуге болатынын және әдетте қандай мәселе шешілетінін түсіндіреді.",
          modal: {
            close: "Санат мәліметін жабу",
            problemType: "Мәселе түрі",
            detailsTitle: "Әдетте не жөнделеді",
            examplesTitle: "Мысалдар",
            whenToUseTitle: "Бұл санатты қашан таңдау керек",
          },
          labels: {
            electricity: "Электр қуаты",
            water: "Сумен қамтамасыз ету",
            heating: "Жылыту",
            public_order: "Тәртіп бұзушылық",
            sewage: "Кәріз",
            waste: "Қоқыс",
            roads: "Жолдар",
            other: "Басқа",
          },
          cards: {
            electricity: {
              description: "Жарықтың өшуі, электр үзілістері, желідегі апаттар.",
              details:
                "Бұл санатты өшірулер, ашық қауіпті кабельдер, зақымдалған трансформаторлар және істемейтін көше жарығы үшін пайдаланыңыз.",
              example: "Мысалы: шамдар істемейді, кабель зақымы, трансформатор ақауы.",
              whenToUse:
                "Негізгі мәселе электр, жарық немесе электр инфрақұрылымына қатысты болса, осы санатты таңдаңыз.",
            },
            water: {
              description: "Судың болмауы, қысымның әлсіздігі, ағулар мен апаттар.",
              details:
                "Үйде, ғимаратта немесе сыртқы инфрақұрылымда су беру үзіліп, айқын ағу не қысым тұрақсыз болса, осы санатты пайдаланыңыз.",
              example: "Мысалы: құбыр жарылуы, су беру үзілуі, апаттық ағулар.",
              whenToUse:
                "Негізгі мәселе су беру, қысым немесе ағуға қатысты болса, осы санатты таңдаңыз.",
            },
            heating: {
              description: "Үйлердегі жылыту мәселелері, суық батареялар, үзілістер.",
              details:
                "Бұл санатты пәтердің суық болуы, жылудың тұрақсыз берілуі, радиатор мәселелері және басқа жылыту жүйесі ақаулары үшін пайдаланыңыз.",
              example: "Мысалы: жылу жоқ, біркелкі жылымайды, жиі өшеді.",
              whenToUse:
                "Мәселе ғимараттың жылу беруіне немесе жылыту жүйесіне қатысты болса, осы санатты таңдаңыз.",
            },
            public_order: {
              description: "Тәртіп бұзушылық, шу, қоғамдық орындардағы заңсыз әрекеттер.",
              details:
                "Бұл санатты ортақ кеңістіктегі қайталанатын бұзушылықтар, қоғамдық қауіпсіздікке қатер және қала назарын қажет ететін әрекеттер үшін пайдаланыңыз.",
              example: "Мысалы: түнгі шу, жанжал, қауіпті мінез-құлық.",
              whenToUse:
                "Мәселе қауіпсіздікке, шуға немесе қоғамдық орындардағы тәртіпке қатысты болса, осы санатты таңдаңыз.",
            },
            sewage: {
              description: "Кәріз бітелуі, жағымсыз иіс, апаттық жағдайлар.",
              details:
                "Кәріз тасып, су кетпей қалып немесе қатты иіс желідегі ақауды көрсетсе, осы санатты пайдаланыңыз.",
              example: "Мысалы: тасу, бітелу, үй маңындағы өткір иіс.",
              whenToUse:
                "Мәселе кәрізге, тасуға немесе санитарлық қауіпке қатысты болса, осы санатты таңдаңыз.",
            },
            waste: {
              description: "Толып кеткен контейнерлер, қоқысты уақытында шығармау.",
              details:
                "Бұл санатты тұрмыстық қалдықтарды шығарудағы қиындықтар, толған контейнерлер және тазалау кешігуінен туған санитарлық мәселелер үшін пайдаланыңыз.",
              example: "Мысалы: жиналып қалған қоқыс, заңсыз төгу, тазалау кешігуі.",
              whenToUse:
                "Негізгі мәселе қоқыс жинау, контейнерлердің толуы немесе заңсыз төгу болса, осы санатты таңдаңыз.",
            },
            roads: {
              description: "Шұңқырлар, жол зақымдары, таңбалау мәселелері.",
              details:
                "Бұл санатты бұзылған жол жабыны, қауіпті учаскелер, бүлінген бордюрлер және жоқ не өшкен таңбалау үшін пайдаланыңыз.",
              example: "Мысалы: бұзылған жол жабыны, бордюр, өшкен сызықтар.",
              whenToUse:
                "Негізгі мәселе жолдың жағдайына немесе қозғалыс қауіпсіздігіне қатысты болса, осы санатты таңдаңыз.",
            },
            other: {
              description: "Негізгі санаттарға кірмейтін басқа қалалық мәселелер.",
              details:
                "Егер мәселе қала назарын қажет етсе, бірақ оны электр, су, жол, қоқыс не басқа негізгі топқа сенімді түрде жатқызу мүмкін болмаса, осы санатты пайдаланыңыз.",
              example: "Егер мәселе назар талап етсе, бірақ жоғарыдағы санаттарға сай келмесе.",
              whenToUse:
                "Егер негізгі санаттардың ешқайсысы мәселеңізді дәл сипаттамаса, осы санатты таңдаңыз.",
            },
          },
        },
        mapPreview: {
          eyebrow: "Карта алдын ала қарауы",
          title: "Кәдімгі админ тікбұрышының орнына премиум пішімделген кең қалалық карта блогы.",
          description:
            "Өнім көрмесіндей сезілетін бөлімде мәселе шоғырын, статус үлестірімін және соңғы таңдалған өтінімді зерттеңіз.",
        },
        how: {
          eyebrow: "Қалай жұмыс істейді",
          title: "Барлық жол бір ағым болып оқылуы үшін әр кезең біртіндеп ашылады.",
          stepOneTitle: "Тұрғын мәселені хабарлайды",
          stepOneBody:
            "Тұрғын мобильді қосымша не веб арқылы санат, орын, фото және толық мәліметпен өтінім жібереді.",
          stepTwoTitle: "Операторлар сұрыптап, тағайындайды",
          stepTwoBody:
            "Call-орталық қызметкерлері кіріс өтінімдерді қарап, статусын жаңартып, дұрыс әрекет жолын үйлестіреді.",
          stepThreeTitle: "Қалалық қызметтер шешеді",
          stepThreeBody:
            "Өтінім ортақ статустар, пікірлер, ескертпелер және сүйемелдеуші байланыс арқылы алға жылжиды.",
          stepFourTitle: "Тұрғын нәтижені көреді",
          stepFourBody:
            "Мәселені хабарлаған сол адам жаңартуларды бақылап, циклді сенімді түрде жаба алады.",
        },
        cta: {
          badge: "Келесі қалалық өтінімді жасаңыз",
          title: "Бір басумен хабардарлықтан әрекетке өтіңіз.",
          description:
            "Басты бет енді толық хикаяны жеткізеді. Келесі қадам — осы назарды ортақ iKOMEK workflow ішіндегі нақты өтінімге айналдыру.",
          button: "Өтінім құру",
          trust: "Ортақ backend, синхрондалған статустар және өтінімнің бір lifecycle-ы.",
        },
        requestStatus: {
          pending: "Күтуде",
          in_progress: "Орындалуда",
          closed: "Жабық",
          open: "Ашық",
          resolved: "Шешілді",
          rejected: "Қабылданбады",
        },
        sections: {
          pulse: "Қала пульсі",
          pulseDescription: "Ортақ жаңалықтар ағынынан соңғы ескертулер мен жаңартулар.",
          categories: "Танымал санаттар",
          categoriesDescription: "Қолданыстағы backend-тен келетін ортақ өтінім таксономиясы.",
          journey: "Платформа қалай жұмыс істейді",
        },
      },
      auth: {
        loginTab: "Кіру",
        registerTab: "Тіркелу",
        recoverTab: "Қалпына келтіру",
        login: {
          eyebrow: "Кіру",
          title: "Бар iKOMEK аккаунтына кіріңіз",
          subtitle: "Веб және мобильді қосымша бір аутентификацияны, профильдерді, өтінімдерді және чат тарихын пайдаланады.",
        },
        register: {
          eyebrow: "Тіркелу",
          title: "Аккаунт жасау",
          subtitle: "Қош келдіңіз! Тіркелу үшін мәліметтеріңізді толтырыңыз.",
        },
        recovery: {
          eyebrow: "Қалпына келтіру",
          title: "Қолжетімділікті қалпына келтіру",
          subtitle: "Аккаунтыңызға қолжетімділікті қалпына келтіру үшін мәліметтеріңізді енгізіңіз.",
        },
        verification: {
          eyebrow: "Растау",
          title: "Email мекенжайын растаңыз",
          subtitle: "iKOMEK аккаунтын белсендіру үшін email-ге жіберілген бір реттік кодты енгізіңіз.",
          titleText: "Растау коды",
          instructions: "Email мекенжайыңызға жіберілген 6 таңбалы кодты енгізіңіз.",
          sentTo: "Растау коды {{email}} мекенжайына жіберілді.",
          code: "Растау коды",
          codePlaceholder: "6 таңбалы кодты енгізіңіз",
          expiresInMinutes: "Код {{minutes}} минут ішінде жарамды.",
          confirm: "Email растау",
          resend: "Кодты қайта жіберу",
          resendIn: "{{seconds}}с кейін қайта жіберу",
          editEmail: "Email өзгерту",
          codeSent: "Растау коды email мекенжайыңызға жіберілді.",
          resent: "Жаңа растау коды жіберілді.",
          verified: "Email сәтті расталды.",
          loginBlocked: "Аккаунтыңыз әлі расталмаған. Жалғастыру үшін email-дегі кодты енгізіңіз.",
        },
        feedback: {
          loginSuccess: "Сәтті кірдіңіз",
        },
        recoverNotice: {
          title: "Құпиясөзді қалпына келтіру әзірге қолжетімсіз",
          body: "Ортақ FastAPI backend қазір құпиясөзді қалпына келтіру сценарийін ұсынбайды.",
          hint: "Демо-аккаунтты пайдалана аласыз немесе осы беттен жаңа аккаунт жасай аласыз.",
        },
        fields: {
          name: "Аты-жөні",
          email: "Email",
          password: "Құпиясөз",
          phone: "Телефон",
          language: "Қалаулы тіл",
        },
      },
      dashboard: {
        title: "Тұрғынның басқару орталығы",
        description:
          "Өтінімдер, сақталған орындар, ескертулер және жеке белсенділікті бір жерден бақылаңыз.",
        cards: {
          total: "Барлық өтінім",
          active: "Белсенді",
          pending: "Күтуде",
          saved: "Сақталған орындар",
        },
      },
      requests: {
        title: "Өтінімдерді басқару",
        description: "Өтінім lifecycle айналасындағы толық desktop-first тәжірибе.",
        filtersAll: "Барлығы",
        filtersPending: "Күтуде",
        filtersProgress: "Орындалуда",
        filtersClosed: "Жабық",
        timeline: "Статус таймлайны",
        attachments: "Тіркемелер",
        empty: "Бұл фильтр бойынша ештеңе табылмады.",
      },
      newRequest: {
        title: "Жаңа қалалық мәселе жіберу",
        description:
          "Ортақ платформадан сақталған орындарды, координаттарды, санаттарды, себептерді және тіркемелерді пайдаланыңыз.",
        address: "Мекенжай",
        place: "Орын",
        category: "Санат",
        reason: "Себеп",
        descriptionLabel: "Сипаттама",
        attachments: "Тіркемелер",
        geolocate: "Менің орнымды пайдалану",
        summary: "Жіберу алдындағы шолу",
      },
      requestDetails: {
        overview: "Шолу",
        history: "Тарих",
        messages: "Хабарламалар",
      },
      chat: {
        title: "Өтінім чаты",
        description: "Хабарламалар тарихы мобильді қосымшамен синхронды күйде қалады.",
        placeholder: "Хабарлама жазыңыз",
      },
      news: {
        title: "Қалалық жаңалықтар мен хабарламалар",
        description: "Қолданыстағы қалалық контент ағынына арналған ұқыпты редакциялық интерфейс.",
      },
      map: {
        title: "Қаланың тірі картасы",
        description: "Кластерленген ашық өтінімдерді, heatmap аймақтарын және аудан белсенділігін зерттеңіз.",
        all: "Барлық өтінім",
        mine: "Менің өтінімдерім",
        heatmap: "Heatmap",
      },
      profile: {
        title: "Профиль және сақталған орындар",
        addLocation: "Орын қосу",
        notifications: "Хабарламалар",
      },
      operator: {
        title: "Оператор workspace",
        description:
          "Кезекті басқарыңыз, деректерді тексеріңіз және статустарды ортақ жүйеден шықпай жаңартыңыз.",
        update: "Статусты жаңарту",
      },
      admin: {
        title: "Әкімші студиясы",
        description: "Метрикаларды бақылап, қалалық жаңартуларды жинақы workflow арқылы жариялаңыз.",
        publish: "Жаңалық жариялау",
      },
      emptyStates: {
        genericTitle: "Көрсететін дерек жоқ",
        genericDescription: "Backend жазбаларды қайтарған кезде олар автоматты түрде осында шығады.",
      },
    },
  },
} as const;

function detectLanguage() {
  const stored = session.getLocale();
  if (stored === "ru" || stored === "kz" || stored === "en") {
    return stored;
  }

  if (typeof navigator === "undefined") {
    return "en";
  }

  if (navigator.language.startsWith("ru")) {
    return "ru";
  }

  if (navigator.language.startsWith("kk") || navigator.language.startsWith("kz")) {
    return "kz";
  }

  return "en";
}

if (!i18n.isInitialized) {
  void i18n.use(initReactI18next).init({
    resources,
    lng: detectLanguage(),
    fallbackLng: "en",
    interpolation: {
      escapeValue: false,
    },
  });
}

export { i18n };

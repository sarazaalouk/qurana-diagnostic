# نشر تشخيص قرآنا على Render مع Supabase

الترتيب: Supabase الأول (عشان المفاتيح)، بعدين GitHub، بعدين Render.
المفاتيح كلها بتتحط في لوحات التحكم بس، ولا تتكتب في الكود ولا تتبعت في الشات.

## 1) Supabase: قاعدة البيانات

1. ادخلي supabase.com ← **New project**.
   - الاسم: `qurana`.
   - Region: **Central EU (Frankfurt)**، نفس منطقة Render، فالحفظ يبقى أسرع.
   - Database password: اختاري كلمة قوية واحفظيها عندك. التطبيق نفسه مش محتاجها.
2. استني لحد ما المشروع يجهز (دقيقة أو اتنين).
3. من القائمة الجانبية افتحي **SQL Editor** ← **New query**.
4. انسخي محتوى الملف `docs/supabase.sql` كله، والصقيه، واضغطي **Run**. لازم تظهر رسالة **Success. No rows returned**.
5. افتحي **Table Editor**. هتلاقي جدول `diagnoses` فاضي، وجنبه علامة إن RLS شغال. ده الصح: الجدول مقفول على أي حد غير السيرفر.
6. افتحي **Project Settings** ← **API Keys** (أو **API** في النسخ القديمة) وخدي حاجتين:
   - **Project URL** (زي `https://xxxx.supabase.co`) ← ده `SUPABASE_URL`.
   - المفتاح السري: **Secret key** (بيبدأ بـ `sb_secret_`)، أو **service_role** في النسخ القديمة ← ده `SUPABASE_SERVICE_KEY`.
     - ⚠️ المفتاح ده بيفتح الجدول كله. يتحط في Render بس، وما يتبعتش لحد.
     - مفتاح **anon / publishable** مش هو المطلوب.

## 2) GitHub: مكان الكود اللي Render بيقرا منه

المشروع دلوقتي على جهازك بس (أول commit في git، ومفيش remote).

1. ادخلي github.com ← **New repository**.
   - الاسم: `qurana-diagnostic`.
   - **Private**.
   - ما تختاريش README ولا .gitignore ولا License، عشان المستودع يبقى فاضي.
2. ابعتيلي رابط المستودع وأنا أرفع الكود، أو ارفعيه بنفسك من مجلد المشروع:
   ```bash
   git remote add origin https://github.com/<اسم-حسابك>/qurana-diagnostic.git
   git push -u origin main
   ```

## 3) Render: الخدمة

**لو لسه ما عندكيش خدمة للتشخيص:**
1. dashboard.render.com ← **New** ← **Blueprint**.
2. اختاري مستودع `qurana-diagnostic`. Render هيقرا `render.yaml` ويطلّع خدمة اسمها `qurana-diagnostic` على خطة Starter. Starter مدفوعة، لكنها شغالة على طول، أما الخطة المجانية فبتنام وأول ولي أمر هيستنى حوالي دقيقة.
3. Render هيطلب منك قيم الخانات السرية. حطي فيها:
   - `SUPABASE_URL`: من الخطوة 1-6.
   - `SUPABASE_SERVICE_KEY`: من الخطوة 1-6.
   - `ANTHROPIC_API_KEY`: مفتاح Claude.
   - `ADMIN_PIN`: رقم جديد من اختيارك لصفحة `/admin`. ما تبعتيهوش في الشات.
   - `PUBLIC_BASE_URL`: رابط الخدمة على Render دلوقتي (زي `https://qurana-diagnostic.onrender.com`)، وبعد ما الدومين يتربط غيّريه لـ`https://test.quraana-institute.com`. ده اللي بيتبني منه رابط النتيجة اللي بيتنسخ وبيتبعت على واتساب.
4. اضغطي **Apply**.

**لو عندك خدمة قديمة للتشخيص (اللي طلعت فيها رسالة «تعذّر حفظ النتيجة»):**
1. افتحي الخدمة ← **Logs** ← دوّري على `POST /api/results` أو `results:`. السطر اللي تحتهم بيقول السبب. الاحتمال الأقرب إن `DATA_STORE_DIR=/var/data` مضبوط من غير Disk متركّب، فالسيرفر ما يقدرش يكتب في المجلد.
2. **Settings** ← تأكدي إن المستودع `qurana-diagnostic` والفرع `main`.
3. **Environment**:
   - ضيفي `SUPABASE_URL` و`SUPABASE_SERVICE_KEY` و`ADMIN_PIN`، وتأكدي إن `ANTHROPIC_API_KEY` موجود.
   - امسحي `DATA_STORE_DIR` لو موجود.
4. **Save, rebuild, and deploy**.

## 4) التأكد بعد النشر

1. **Logs:** لازم يظهر السطر `Qurana diagnostic on … (results: supabase)`. لو مكتوب `files`، يبقى المتغيرين ناقصين أو فيهم غلط.
2. افتحي `https://<الخدمة>.onrender.com/admin` ← ادخلي برقم `ADMIN_PIN`. لازم يظهر «حفظ النتائج: قاعدة بيانات Supabase»، و«روابط النتائج: … (من PUBLIC_BASE_URL)».
3. **افتح التشخيص** ← كمّلي تشخيص تجريبي للآخر.
   - صفحة النتيجة تظهر، والمسار يظهر في حوالي ثانية.
   - الملاحظات بتوصل بعد كده، في حدود دقيقة.
4. في Supabase ← **Table Editor** ← `diagnoses`: لازم يظهر صف جديد فيه السوق (`kuwait` أو `gulf` أو `international`) والمستوى.
5. الرابط هيفضل مقفول للأهل لحد ما المنهج يتعمد ويتستورد (صفحة `/admin` بتقول ده).

## 5) الدومين `test.quraana-institute.com` (للمطوّر)

- Render ← الخدمة ← **Settings** ← **Custom Domains** ← **Add**: `test.quraana-institute.com`.
- في Namecheap ← cPanel ← Zone Editor: سجل **CNAME**؛ الاسم `test`، والقيمة اللي Render بيديها (`<الخدمة>.onrender.com`).
- ما تغيّروش الـ Nameservers، وما تلمسوش أي سجل تاني (عشان بريد info@ وموقع Lovable يفضلوا شغالين).

## 6) تنبيه بالبريد لكل نتيجة جديدة (info@)

زرار الواتساب في صفحة النتيجة بيفتح واتساب برسالة جاهزة بس، وما بتوصلش إلا لو ولي الأمر داس «إرسال». عشان كده السيرفر بيبعت إيميل لـ info@ مع كل نتيجة بتتحفظ، من صندوق info@ نفسه، من غير أي تغيير في الـ DNS.

- Render ← الخدمة ← **Environment** ← ضيفي:
  - `SMTP_HOST`: سيرفر البريد الصادر من cPanel ← **Email Accounts** ← info@ ← **Connect Devices** (غالبًا `mail.quraana-institute.com` أو اسم السيرفر المكتوب هناك).
  - `SMTP_PORT`: `465`
  - `SMTP_USER`: `info@quraana-institute.com`
  - `SMTP_PASS`: باسورد صندوق info@ (في Render بس، أبدًا في الكود).
  - `NOTIFY_TO` (اختياري): الإيميل اللي يستلم التنبيه، والافتراضي `SMTP_USER`.
- بعد الحفظ والنشر، صفحة `/admin` لازم تقول «تنبيه كل نتيجة جديدة بالبريد: مفعّل»، وتحتها «الاتصال بسيرفر البريد: سليم». ده بيدخل على سيرفر البريد بالباسورد من غير ما يبعت حاجة. لو فشل، السبب بيظهر مكتوب.
- زرار «ابعت إيميل تجريبي» في `/admin` بيبعت رسالة ثابتة لـ `NOTIFY_TO`، من غير أي نتيجة ومن غير ما يتحفظ حاجة، وبحد أقصى 3 مرات في الساعة.
- في الـ Logs على Render: `notify: email sent for result …` مع كل إيميل اتبعت، و`notify: … failed: <السبب>` لو فيه مشكلة.
- الإيميل فيه نفس اللي في `/admin` وبس: بالغ أو طفل (والاسم المستعار)، المستوى، العمر، الدولة، ورابط النتيجة.
- لو البريد وقع، نتيجة ولي الأمر بتتحفظ عادي، والخطأ بيتكتب في الـ Logs على Render (`notify: email for result … failed`).

## 7) عدّاد رحلة الزوار (من غير بيانات شخصية)

بيعدّ كام زائر وصل لكل خطوة: فتح الصفحة، داس «ابدأ»، بدأ الاختبار، خلّص، اتحفظت النتيجة، شاف النتيجة، داس الواتساب أو الحجز. كمان بيعدّ مين ظهرله «ناقص بيانات» ومين فشل حفظ نتيجته. كل ده بيظهر في `/admin` ← «رحلة الزوار»، النهاردة أو آخر 7 أو 30 يوم، ومقسّم حسب المصدر.

- **مرة واحدة:** Supabase ← SQL Editor ← New query ← الصقي آخر جزء في `docs/supabase.sql` (جدول `funnel_events`) ← Run. من غيره العدّاد ما بيسجّلش حاجة، والتشخيص شغال عادي.
- **المصدر:** حطي في اللينك `utm_source` و`utm_campaign`، مثلًا:
  `https://qurana-diagnostic.onrender.com/?utm_source=meta&utm_campaign=diagnostic_launch`
  من غيرهم بيتسجّل الموقع اللي جه منه الزائر (مثلًا `quraana-institute.com`)، أو `direct`.
- **اللي بيتسجّل:** الخطوة، ورقم عشوائي للتاب (عشان الزائر يتعدّ مرة واحدة)، طفل ولا بالغ، اللغة، والمصدر. مفيش اسم، ولا إجابات، ولا IP.

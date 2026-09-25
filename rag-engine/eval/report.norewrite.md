# RAG Accuracy Report — 6-doc KB, all sets, no rewrite

- Items evaluated: **314**
- Pipeline: hybrid=True rerank=True
- Refusal accuracy: **53.5%** (in-scope answered, out-of-scope refused)
- Retrieval accuracy: **94.1%** (expected document among top-k sources)
- Retrieval top-1: **76.4%** (expected document is the best-ranked chunk)
- Gate margin: in-scope min top_score 0.0003 vs out-of-scope max 0.1844
- Answer correctness (LLM judge): **nan%** over 0 judged answers

## Retrieval by document

| Document | Recall |
|---|---|
| тушаал №199 | 93.5% |
| гарын авлага 2022 | 98.2% |
| гарын авлага 2022 | дүрэм 2022 | 100.0% |
| дүрэм 2022 | тушаал №199 | гарын авлага 2022 | 100.0% |
| тушаал №199 | гарын авлага 2022 | 100.0% |
| дүрэм 2022 | 80.5% |
| Тушаал №27 | 95.3% |
| сэтгүүл | 92.7% |
| 2030 | 100.0% |
| ШУТИС дүрэм 2022 (web) | 100.0% |
| ШУТИС тушаал №199 (2025-06-06) | 100.0% |
| Тушаал №27 (2025-2026 хичээлийн жил) | 100.0% |
| Шинэ оюутанд зориулсан гарын авлага 2022 | 100.0% |
| ШУТИС сэтгүүл | 100.0% |
| 2030 хөтөлбөрийн гарын авлага | 100.0% |

## By phrasing

| Variant | Items | Refusal | Retrieval | Top-1 | Answer |
|---|---|---|---|---|---|
| en | 86 | 20.9% | 98.8% | 82.9% | nan% |
| mn | 86 | 87.2% | 98.8% | 95.1% | nan% |
| mn-latin | 86 | 22.1% | 81.7% | 40.2% | nan% |

## Per-question

| id | refusal | retrieval | top-1 | top_score | answer | question |
|---|---|---|---|---|---|---|
| seed-grade-breakdown-en | ✓ | ✓ | ✓ | 0.464 | — | how many points is a course graded out of in total? |
| seed-grade-breakdown-mn | ✓ | ✓ | ✓ | 0.989 | — | Оюутны хичээлийн дүнг нийт хэдэн оноогоор үнэлдэг вэ? |
| seed-grade-breakdown-mn-latin | ✗ | ✗ | ✗ | 0.014 | — | hicheeliin dung niit heden onoogoor dvgnedeg ve |
| seed-grade-A-en | ✗ | ✓ | ✓ | 0.030 | — | how many points do i need to get an A? |
| seed-grade-A-mn | ✗ | ✓ | ✗ | 0.148 | — | A үнэлгээ авахын тулд хэдэн оноо авах ёстой вэ? |
| seed-grade-A-mn-latin | ✗ | ✓ | ✗ | 0.001 | — | A avahiin tuld heden onoo avah ystoi ve |
| seed-grade-lowest-en | ✗ | ✓ | ✗ | 0.005 | — | what's the lowest failing grade and how many grade points is |
| seed-grade-lowest-mn | ✗ | ✓ | ✗ | 0.088 | — | Хамгийн доод буюу унасан үнэлгээ юу вэ, хэдэн голч оноотой в |
| seed-grade-lowest-mn-latin | ✗ | ✓ | ✓ | 0.007 | — | hamgiin muu unasan dun ni yu ve, heden golch onootoi ve |
| seed-grade-Aminus-en | ✓ | ✓ | ✓ | 0.395 | — | what's the score range for an A- and how many grade points i |
| seed-grade-Aminus-mn | ✓ | ✓ | ✓ | 0.733 | — | A- үнэлгээний онооны хязгаар болон голч оноо хэд вэ? |
| seed-grade-Aminus-mn-latin | ✗ | ✓ | ✗ | 0.023 | — | A- avahad heden onoo heregtei ve, golch ni hed ve |
| seed-dorm-branch-en | ✗ | ✓ | ✗ | 0.001 | — | does every branch schools have dorms |
| seed-dorm-branch-mn | ✓ | ✓ | ✓ | 0.300 | — | Салбар сургууль бүр оюутны байртай юу? |
| seed-dorm-branch-mn-latin | ✗ | ✓ | ✓ | 0.002 | — | salbar surguuli bolgon oyutnii bairtai yu? |
| seed-gpa-graduate-en | ✗ | ✓ | ✓ | 0.080 | — | what gpa do i supposed to get at least to graduate |
| seed-gpa-graduate-mn | ✗ | ✓ | ✓ | 0.157 | — | Төгсөхийн тулд голч дүн хамгийн багадаа хэд байх ёстой вэ? |
| seed-gpa-graduate-mn-latin | ✗ | ✓ | ✗ | 0.001 | — | tugsuhiin tuld golch hamgiin bagadaa hed baih ystoi ve |
| seed-midterm-count-en | ✗ | ✓ | ✓ | 0.002 | — | how many mid term exams are there |
| seed-midterm-count-mn | ✓ | ✓ | ✓ | 0.947 | — | Улиралд хэдэн удаа явцын шалгалт авдаг вэ? |
| seed-midterm-count-mn-latin | ✗ | ✓ | ✓ | 0.007 | — | ulirliin dunduur heden shalgalt avdag ve? |
| seed-sict-website-en | ✗ | ✓ | ✗ | 0.060 | — | what is the website of our school which is School of Informa |
| seed-sict-website-mn | ✓ | ✓ | ✗ | 0.920 | — | Мэдээлэл, холбооны технологийн сургуулийн вэб сайтын хаяг юу |
| seed-sict-website-mn-latin | ✗ | ✓ | ✗ | 0.015 | — | manai MHTS surguuliin web saitiin hayag yu ve |
| seed-pass-not-F-en | ✗ | ✓ | ✓ | 0.006 | — | what grade do i supposed to get out of 100 to not to get F |
| seed-pass-not-F-mn | ✓ | ✓ | ✓ | 0.232 | — | F үнэлгээ авахгүйн тулд 100 онооноос хамгийн багадаа хэдэн о |
| seed-pass-not-F-mn-latin | ✗ | ✓ | ✓ | 0.012 | — | F avahgui baihiin tuld 100aas heden onoo avah ystoi ve |
| seed-pass-threshold-en | ✗ | ✓ | ✓ | 0.002 | — | what grade do i supposed to get to pass the bar |
| seed-pass-threshold-mn | ✗ | ✓ | ✓ | 0.073 | — | Хичээлд тэнцэхийн тулд хамгийн багадаа ямар дүн авах шаардла |
| seed-pass-threshold-mn-latin | ✗ | ✓ | ✗ | 0.005 | — | hicheeld tentsehiin tuld hamgiin bagadaa yamar dun avah here |
| seed-refuse-flight-en | ✓ | — | — | 0.000 | — | how much is a flight ticket from ulaanbaatar to tokyo? |
| seed-refuse-flight-mn | ✓ | — | — | 0.000 | — | Улаанбаатараас Токио хүрэх онгоцны тийзний үнэ хэд вэ? |
| seed-refuse-flight-mn-latin | ✓ | — | — | 0.001 | — | ulaanbaatraas tokio yavah ongotsnii tiiz hed ve |
| seed-refuse-recipe-en | ✓ | — | — | 0.002 | — | give me a goulash recipe |
| seed-refuse-recipe-mn | ✓ | — | — | 0.003 | — | Гуляшийн жор бичиж өгөөч. |
| seed-refuse-recipe-mn-latin | ✓ | — | — | 0.001 | — | gulyashnii jor bichij ugluuch |
| seed-refuse-weather-en | ✓ | — | — | 0.002 | — | what's the weather going to be like in ulaanbaatar tomorrow? |
| seed-refuse-weather-mn | ✓ | — | — | 0.000 | — | Маргааш Улаанбаатарт цаг агаар ямар байх вэ? |
| seed-refuse-weather-mn-latin | ✓ | — | — | 0.000 | — | margaash ulaanbaatart tsag agaar yamar baih ve |
| seed-refuse-celebrity-en | ✓ | — | — | 0.003 | — | who is the 2026 world chess champion? |
| seed-refuse-celebrity-mn | ✓ | — | — | 0.001 | — | 2026 оны дэлхийн шатрын аварга хэн бэ? |
| seed-refuse-celebrity-mn-latin | ✓ | — | — | 0.003 | — | 2026 onii delhiin shatriin avarga hen be |
| hb-transit-card-en | ✗ | ✓ | ✓ | 0.024 | — | when can i order the student bus discount card and who handl |
| hb-transit-card-mn | ✓ | ✓ | ✓ | 0.535 | — | Нийтийн тээврийн хөнгөлөлттэй картын захиалга хэзээ явагддаг |
| hb-transit-card-mn-latin | ✗ | ✓ | ✓ | 0.075 | — | niitiin teeveriin hungulultei kart hezee zahialah ve? haana  |
| hb-tutor-club-en | ✓ | ✓ | ✓ | 0.592 | — | im falling behind in math and physics, is there a club or tu |
| hb-tutor-club-mn | ✓ | ✓ | ✓ | 0.989 | — | Математик, физикийн хичээлээр хоцрогдсон бол туслах клуб бай |
| hb-tutor-club-mn-latin | ✗ | ✗ | ✗ | 0.010 | — | matematik fizik deer hotsorood bn, tuslah club bdg uu? |
| hb-dev-loan-gpa-en | ✗ | ✓ | ✓ | 0.094 | — | what gpa do i need to get the student development loan from  |
| hb-dev-loan-gpa-mn | ✓ | ✓ | ✓ | 0.993 | — | Боловсролын зээлийн сангийн “Оюутны хөгжлийн зээл”-д хамрагд |
| hb-dev-loan-gpa-mn-latin | ✗ | ✓ | ✗ | 0.018 | — | oyutnii hugjliin zeeld hamragdahad golch dun hed baih ystoi  |
| hb-scholarship-requirements-en | ✗ | ✓ | ✓ | 0.149 | — | what are the general requirements to apply for scholarships? |
| hb-scholarship-requirements-mn | ✓ | ✓ | ✓ | 0.982 | — | Гадаад, дотоод тэтгэлэгт хамрагдахад ерөнхийдөө ямар шаардла |
| hb-scholarship-requirements-mn-latin | ✗ | ✓ | ✗ | 0.038 | — | tetgeleg avahad yamar shaardlaga tavidag ve? golch hed bh ys |
| hb-dorm-registration-en | ✗ | ✓ | ✓ | 0.002 | — | how and when do i sign up for the dorm? |
| hb-dorm-registration-mn | ✓ | ✓ | ✓ | 0.807 | — | Оюутны байранд амьдрахын тулд хэзээ, яаж бүртгүүлэх вэ? |
| hb-dorm-registration-mn-latin | ✗ | ✓ | ✗ | 0.003 | — | dotuur bairand hezee yaj burtguuleh ve |
| hb-credit-incentive-en | ✗ | ✓ | ✓ | 0.151 | — | what kind of achievements get you the credit incentive (cred |
| hb-credit-incentive-mn | ✓ | ✓ | ✓ | 0.943 | — | Кредитийн урамшууллыг ямар амжилт гаргасан оюутанд олгодог в |
| hb-credit-incentive-mn-latin | ✗ | ✓ | ✓ | 0.123 | — | kreditiin uramshuulal yamar amjilt gargasan oyutand ugdug ve |
| hb-part-time-job-en | ✗ | ✓ | ✓ | 0.003 | — | i want a part-time job while studying, does the uni help wit |
| hb-part-time-job-mn | ✗ | ✓ | ✓ | 0.163 | — | Сурахын зэрэгцээ цагийн ажил хийх гэсэн юм, сургууль ажилд з |
| hb-part-time-job-mn-latin | ✗ | ✓ | ✗ | 0.003 | — | surangaa tsagiin ajil hiimeer bn, surguuli ajild zuuchildag  |
| hb-reading-room-mhts-en | ✗ | ✓ | ✓ | 0.045 | — | which library reading room is for SICT students and what are |
| hb-reading-room-mhts-mn | ✓ | ✓ | ✓ | 0.991 | — | МХТС-ийн оюутнууд номын сангийн аль уншлагын танхимд үйлчлүү |
| hb-reading-room-mhts-mn-latin | ✗ | ✓ | ✗ | 0.002 | — | mhts iin oyutnuud nomiin sangiin ali unshlagiin tanhimd suuh |
| hb-library-home-loan-en | ✗ | ✓ | ✓ | 0.012 | — | can i borrow books from the library and take them home? for  |
| hb-library-home-loan-mn | ✓ | ✓ | ✓ | 0.866 | — | Номын сангаас ном гэртээ аваад явж болох уу, хэд хоногоор ол |
| hb-library-home-loan-mn-latin | ✗ | ✓ | ✗ | 0.001 | — | nomiin sangaas nom gertee avch yavj boloh uu? hed honogoor u |
| hb-health-center-en | ✗ | ✓ | ✓ | 0.016 | — | is the campus clinic free for students? |
| hb-health-center-mn | ✓ | ✓ | ✓ | 0.873 | — | Сургуулийн Эрүүл мэнд, спортын төвд оюутнууд үнэ төлбөргүй ү |
| hb-health-center-mn-latin | ✗ | ✓ | ✓ | 0.004 | — | surguuliin emneleg oyutnuudad unegui yu |
| hb-announcements-en | ✓ | ✓ | ✓ | 0.315 | — | where do i find announcements about events and stuff for stu |
| hb-announcements-mn | ✓ | ✓ | ✓ | 0.950 | — | Оюутанд зориулсан зар, мэдээллийг хаанаас харж болох вэ? |
| hb-announcements-mn-latin | ✗ | ✓ | ✗ | 0.003 | — | oyutnii zar medeelliig haanaas harj boloh ve |
| hb-schedule-tip-en | ✓ | ✓ | ✓ | 0.681 | — | any tips for picking class times in course selection 2 so i  |
| hb-schedule-tip-mn | ✓ | ✓ | ✓ | 0.999 | — | Хичээл сонголт 2 хийхдээ клуб, арга хэмжээнд оролцох цагтай  |
| hb-schedule-tip-mn-latin | ✗ | ✓ | ✗ | 0.014 | — | hicheel songolt 2 hiihdee tsagaa yaj songoh ni zuitei ve, cl |
| qms-iso-standards-en | ✓ | ✓ | ✓ | 0.210 | — | since when has must been following iso 9001 and iso 21001 st |
| qms-iso-standards-mn | ✓ | ✓ | ✓ | 1.000 | — | ШУТИС хэдэн оноос ISO 9001:2015 болон ISO 21001:2018 стандар |
| qms-iso-standards-mn-latin | ✓ | ✓ | ✓ | 0.750 | — | shutis heden onoos iso 9001, iso 21001 standartiig nevtruulj |
| qms-mechtrans-location-en | ✓ | ✓ | ✓ | 0.308 | — | where is the mechanical and transport school? which building |
| qms-mechtrans-location-mn | ✓ | ✓ | ✓ | 0.873 | — | Механик, тээврийн сургууль хаана, аль байранд байрладаг вэ? |
| qms-mechtrans-location-mn-latin | ✗ | ✗ | ✗ | 0.001 | — | mehanik teevriin surguuli haana bdag ve? hed dugaar bair |
| qms-quality-policy-en | ✗ | ✓ | ✓ | 0.108 | — | what's must's quality policy? |
| qms-quality-policy-mn | ✓ | ✓ | ✓ | 0.999 | — | ШУТИС-ийн чанарын бодлого юу вэ? |
| qms-quality-policy-mn-latin | ✓ | ✓ | ✓ | 0.588 | — | shutisiin chanariin bodlogo yu ve |
| qms-risk-levels-en | ✗ | ✓ | ✓ | 0.002 | — | in must's risk matrix what score makes a risk unacceptable?  |
| qms-risk-levels-mn | ✓ | ✓ | ✓ | 0.727 | — | Эрсдэлийн үнэлгээний матрицаар аюулын түвшинг хэрхэн ангилда |
| qms-risk-levels-mn-latin | ✗ | ✗ | ✗ | 0.001 | — | ersdeliin matrits deer hed onootoi ersdeliig zuvshuuruhgui g |
| qms-special-needs-exam-en | ✗ | ✓ | ✓ | 0.143 | — | if a special needs student can't write or can't come to clas |
| qms-special-needs-exam-mn | ✓ | ✓ | ✓ | 0.915 | — | Тусгай хэрэгцээт оюутан бичиж чадахгүй эсвэл танхимаар сурал |
| qms-special-needs-exam-mn-latin | ✗ | ✗ | ✗ | 0.006 | — | tusgai heregtseet oyutan bichij chadahgui bol shalgaltaa yaj |
| qms-doc-levels-en | ✗ | ✓ | ✓ | 0.012 | — | how many levels of documents are there in the quality manage |
| qms-doc-levels-mn | ✗ | ✓ | ✓ | 0.182 | — | ЧМТ-ны баримт бичиг хэдэн түвшинд хуваагддаг вэ, тус бүр нь  |
| qms-doc-levels-mn-latin | ✗ | ✓ | ✓ | 0.031 | — | chmt-iin barimt bichig heden tuvshintei ve, tus bur ni yu ve |
| qms-semester-length-en | ✓ | ✓ | ✓ | 0.297 | — | how many weeks is a fall or spring semester and how long is  |
| qms-semester-length-mn | ✓ | ✓ | ✓ | 0.998 | — | Намар, хаврын улирлын хичээл хэдэн долоо хоног үргэлжилдэг в |
| qms-semester-length-mn-latin | ✗ | ✗ | ✗ | 0.017 | — | namriin bolon havriin uliral heden doloo honog vrgeljildeg v |
| qms-course-selection-raci-en | ✗ | ✗ | ✗ | 0.119 | — | who's responsible for course selection 1? does my advisor ha |
| qms-course-selection-raci-mn | ✓ | ✗ | ✗ | 0.855 | — | Хичээл сонголт 1 хийх үйл явцад оюутан, зөвлөх багш, сургалт |
| qms-course-selection-raci-mn-latin | ✗ | ✗ | ✗ | 0.002 | — | hicheel songolt 1 hiihed hen ni yu hariutsdag ve, zuvluh bag |
| qms-graduate-survey-en | ✗ | ✓ | ✓ | 0.103 | — | does the university survey graduates after they finish? when |
| qms-graduate-survey-mn | ✓ | ✓ | ✓ | 0.812 | — | Төгсөгчдөөс санал асуулгыг хэзээ, ямар түүврийн хэмжээтэй ав |
| qms-graduate-survey-mn-latin | ✗ | ✗ | ✗ | 0.005 | — | tugsuguudees sanal asuulga avdag uu? hezee avdag ve |
| qms-complaint-steps-en | ✗ | ✓ | ✓ | 0.172 | — | what are the steps for handling complaints or disputes from  |
| qms-complaint-steps-mn | ✓ | ✓ | ✓ | 1.000 | — | Сонирхогч талуудын гомдол, маргааныг барагдуулах үйл явц яма |
| qms-complaint-steps-mn-latin | ✗ | ✓ | ✗ | 0.035 | — | gomdol margaaniig yaj shiidverledeg ve, yamar alhamuudtai ve |
| qms-internal-audit-en | ✗ | ✓ | ✓ | 0.066 | — | how often is the internal audit of the quality system done a |
| qms-internal-audit-mn | ✓ | ✓ | ✓ | 0.764 | — | ЧМТ-ны дотоод аудитыг хэр давтамжтай хийдэг вэ, аудитын үр д |
| qms-internal-audit-mn-latin | ✗ | ✓ | ✗ | 0.009 | — | dotood auditiig hicheeliin jild hed hiideg ve, ur dung ni ya |
| qms-nonconformity-actions-en | ✗ | ✓ | ✓ | 0.105 | — | if a nonconformity is found, what actions can be taken to co |
| qms-nonconformity-actions-mn | ✓ | ✓ | ✓ | 0.942 | — | Үл тохирол илэрвэл түүнийг залруулахад ямар арга хэмжээ авч  |
| qms-nonconformity-actions-mn-latin | ✗ | ✓ | ✗ | 0.012 | — | ul tohirol ilervel yamar arga hemjee avch boloh ve |
| o199-class-hour-en | ✗ | ✓ | ✓ | 0.141 | — | how long is one class period at must? 50 mins or what |
| o199-class-hour-mn | ✓ | ✓ | ✓ | 0.856 | — | Хичээлийн 1 цаг хэдэн минут үргэлжилдэг вэ? |
| o199-class-hour-mn-latin | ✓ | ✓ | ✓ | 0.289 | — | hicheeliin 1 tsag heden minut baidag ve |
| o199-minor-requirements-en | ✗ | ✓ | ✓ | 0.083 | — | what are the requirements to join a minor program (havsarga) |
| o199-minor-requirements-mn | ✓ | ✓ | ✓ | 0.951 | — | Хавсарга хөтөлбөрөөр суралцахын тулд ямар шаардлага хангах ё |
| o199-minor-requirements-mn-latin | ✗ | ✓ | ✓ | 0.058 | — | havsarga hutulbureer surahad yamar shaardlaga hangah ystoi v |
| o199-double-major-en | ✗ | ✓ | ✓ | 0.032 | — | can i do a double major? how many credits and what gpa do i  |
| o199-double-major-mn | ✓ | ✓ | ✓ | 0.991 | — | Хос мэргэжил эзэмшихийн тулд хэдэн кредит цуглуулсан, голч д |
| o199-double-major-mn-latin | ✗ | ✓ | ✗ | 0.025 | — | hos mergejil ezemshiye gevel heden kredit tsugluulsan, golch |
| o199-drop-course-week5-en | ✗ | ✓ | ✓ | 0.030 | — | until what week can i drop a class? and do i still pay if i  |
| o199-drop-course-week5-mn | ✓ | ✓ | ✓ | 0.994 | — | Сонгосон хичээлээ хэддүгээр долоо хоног хүртэл цуцалж болох  |
| o199-drop-course-week5-mn-latin | ✗ | ✓ | ✗ | 0.003 | — | songoson hicheelee hed dugaar doloo honog hurtel tsutsalj bo |
| o199-english-b1-en | ✓ | ✓ | ✓ | 0.205 | — | what english level do i need to graduate |
| o199-english-b1-mn | ✓ | ✓ | ✓ | 0.487 | — | Төгсөхийн тулд англи хэлний ямар түвшинтэй байх шаардлагатай |
| o199-english-b1-mn-latin | ✗ | ✓ | ✓ | 0.004 | — | tugsuhiin tuld angli helnii yamar tuvshintei baih ystoi ve |
| o199-credit-by-exam-en | ✗ | ✓ | ✓ | 0.018 | — | how many courses can i take the credit-by-exam test for in o |
| o199-credit-by-exam-mn | ✓ | ✓ | ✓ | 0.994 | — | Кредит шууд тооцох шалгалтыг нэг улиралд хэдэн хичээлээр өгч |
| o199-credit-by-exam-mn-latin | ✗ | ✓ | ✓ | 0.074 | — | kredit shuud tootsoh shalgaltiig neg uliral heden hicheel de |
| o199-wf-mark-en | ✗ | ✓ | ✗ | 0.001 | — | when do you get a WF on a course? how much do you have to mi |
| o199-wf-mark-mn | ✗ | ✓ | ✓ | 0.177 | — | Хичээлд WF тэмдэглэгээ ямар тохиолдолд тавигддаг вэ? |
| o199-wf-mark-mn-latin | ✗ | ✓ | ✗ | 0.003 | — | WF temdeglegee yamar ved tavigddag ve |
| o199-army-ca-cancel-en | ✗ | ✓ | ✓ | 0.005 | — | if i get drafted into the army in the middle of the semester |
| o199-army-ca-cancel-mn | ✓ | ✓ | ✓ | 0.458 | — | Улирлын дундуур цэргийн албанд татагдвал сонгосон хичээл, тө |
| o199-army-ca-cancel-mn-latin | ✗ | ✓ | ✓ | 0.001 | — | uliral dundaa tsergt tatagdval songoson hicheel tulburuu yah |
| o199-program-transfer-en | ✗ | ✓ | ✓ | 0.030 | — | i wanna switch majors inside must, what do i need to qualify |
| o199-program-transfer-mn | ✓ | ✓ | ✓ | 0.997 | — | ШУТИС дотроо өөр хөтөлбөр рүү шилжихэд ямар шалгуур хангах ё |
| o199-program-transfer-mn-latin | ✗ | ✓ | ✗ | 0.003 | — | shutis dotroo uur hutulbur luu shiljihed yamar shalguur hang |
| o199-leave-duration-en | ✗ | ✓ | ✓ | 0.034 | — | how long can i take academic leave for? whats the max total |
| o199-leave-duration-mn | ✓ | ✓ | ✓ | 0.921 | — | Чөлөөг хэр хугацаагаар авч болох вэ, нийтдээ хэдэн жил хүртэ |
| o199-leave-duration-mn-latin | ✗ | ✗ | ✗ | 0.016 | — | chuluu heden hugatsaagaar avch boloh ve, niitdee hed jil hur |
| o199-readmission-10yr-en | ✗ | ✓ | ✓ | 0.012 | — | if i left school can i come back and re-enroll later? is the |
| o199-readmission-10yr-mn | ✓ | ✓ | ✓ | 0.951 | — | Сургуулиас чөлөөлөгдсөний дараа буцаж элсэх боломжтой юу, хэ |
| o199-readmission-10yr-mn-latin | ✗ | ✗ | ✗ | 0.000 | — | surguuliasaa chuluulugdsun bol butsaad elsej boloh uu? heden |
| o199-transfer-credit-cap-en | ✓ | ✓ | ✓ | 0.277 | — | transferring from another uni, how many credits can they rec |
| o199-transfer-credit-cap-mn | ✓ | ✓ | ✓ | 0.997 | — | Өөр их сургуулиас шилжиж ирэхэд өмнө судалсан хичээлээс хэдэ |
| o199-transfer-credit-cap-mn-latin | ✗ | ✓ | ✓ | 0.012 | — | uur ih surguuliias shiljij irvel umnu uzsen hicheelees heden |
| o27-exam-validity-en | ✗ | ✓ | ✓ | 0.002 | — | i took the entrance exam last year, can i still use that sco |
| o27-exam-validity-mn | ✓ | ✓ | ✓ | 0.981 | — | Өмнөх жил өгсөн ЭЕШ-ын оноогоороо ШУТИС-д элсэж болох уу? Ба |
| o27-exam-validity-mn-latin | ✗ | ✓ | ✗ | 0.068 | — | umnuh jil ugsun EESH-iin onoogoor shutis-d orj boloh uu? bat |
| o27-no-exam-work-experience-en | ✗ | ✓ | ✗ | 0.005 | — | im 32 and have worked in my field for like 5 years, can i ge |
| o27-no-exam-work-experience-mn | ✓ | ✓ | ✓ | 0.861 | — | 30 гарсан, мэргэжлийн чиглэлээрээ хэдэн жил ажилласан хүн ЭЕ |
| o27-no-exam-work-experience-mn-latin | ✗ | ✓ | ✗ | 0.047 | — | 30 garsan, mergejileeree heden jil ajillasan hun EESH-giin o |
| o27-multiple-exam-login-en | ✗ | ✓ | ✓ | 0.156 | — | i took the EESH twice, which registration number do i use to |
| o27-multiple-exam-login-mn | ✓ | ✓ | ✓ | 0.997 | — | ЭЕШ-ыг хоёр удаа өгсөн бол ШУТИС-ийн элсэлтийн бүртгэлд аль  |
| o27-multiple-exam-login-mn-latin | ✗ | ✓ | ✓ | 0.047 | — | EESH 2 udaa ugchihsun, shutis-iin elseltiin burtgeld ali bur |
| o27-german-statistics-en | ✓ | ✓ | ✓ | 0.249 | — | theres a statistics program taught in german right? how does |
| o27-german-statistics-mn | ✓ | ✓ | ✓ | 0.987 | — | Герман хэлээр явагддаг Статистик хөтөлбөр ямар онцлогтой вэ? |
| o27-german-statistics-mn-latin | ✓ | ✓ | ✓ | 0.256 | — | german heleer ordog statistik hutulbur yamar ontslogtoi ve?  |
| o27-skill-exam-conversion-en | ✗ | ✓ | ✓ | 0.063 | — | got 87 out of 100 on the skill exam, what scaled score does  |
| o27-skill-exam-conversion-mn | ✓ | ✓ | ✓ | 0.564 | — | Ур чадварын шалгалтад 87 оноо авсан бол хэмжээст оноо хэд бо |
| o27-skill-exam-conversion-mn-latin | ✗ | ✓ | ✗ | 0.011 | — | ur chadvariin shalgaltand 87 avsan bol hemjeest onoo ni hed  |
| o27-total-score-weight-en | ✗ | ✓ | ✗ | 0.011 | — | how is the total admission score calculated? like what % is  |
| o27-total-score-weight-mn | ✓ | ✓ | ✓ | 0.984 | — | Нийлбэр оноог тооцохдоо суурь болон дагалдах хичээлийн оноог |
| o27-total-score-weight-mn-latin | ✗ | ✓ | ✗ | 0.003 | — | niilber onoog yaj bodoh ve? suuri, dagaldah hicheeliig heden |
| o27-selection-time-limit-en | ✓ | ✓ | ✓ | 0.700 | — | during program selection how long do i get to pick a program |
| o27-selection-time-limit-mn | ✓ | ✓ | ✓ | 0.998 | — | Хөтөлбөр сонголтын үеэр хөтөлбөрөө хэдэн цагийн дотор сонгож |
| o27-selection-time-limit-mn-latin | ✗ | ✓ | ✗ | 0.002 | — | hutulbur songoltiin uyed heden tsagiin dotor songood tulburu |
| o27-enrollee-registration-en | ✗ | ✓ | ✓ | 0.009 | — | got my admission letter, when do i have to register and get  |
| o27-enrollee-registration-mn | ✓ | ✓ | ✓ | 0.847 | — | Суралцах эрхийн бичиг авсны дараа хэзээ, хаана бүртгүүлж оюу |
| o27-enrollee-registration-mn-latin | ✗ | ✗ | ✗ | 0.001 | — | surah erhiin bichgee avsan, hezee oyutnii kod avah ve? hugat |
| o27-affiliated-school-scholarship-en | ✗ | ✓ | ✓ | 0.003 | — | i graduated from one of MUST's own high schools in UB and go |
| o27-affiliated-school-scholarship-mn | ✓ | ✓ | ✓ | 0.995 | — | ШУТИС-ийн харьяа ахлах сургууль төгссөн, хичээл тус бүрдээ 7 |
| o27-affiliated-school-scholarship-mn-latin | ✓ | ✓ | ✓ | 0.516 | — | shutis-iin haryaa ahlah surguuli tugssun, hicheel bolgondoo  |
| o27-teacher-child-support-en | ✗ | ✓ | ✓ | 0.008 | — | my mom has been teaching at a public school for over 15 year |
| o27-teacher-child-support-mn | ✓ | ✓ | ✓ | 0.886 | — | Ээж маань төрийн сургуульд 15 гаруй жил тасралтгүй багшилсан |
| o27-teacher-child-support-mn-latin | ✗ | ✓ | ✗ | 0.007 | — | eej mini turiin surguulid 15 garui jil bagshilsan, bagshiin  |
| o27-non-degree-credits-en | ✗ | ✓ | ✗ | 0.009 | — | i work full time, can i just take a few MUST courses without |
| o27-non-degree-credits-mn | ✓ | ✓ | ✓ | 0.999 | — | Ажил хийдэг хүн зэргийн бус сургалтаар ШУТИС-д хичээл үзэж б |
| o27-non-degree-credits-mn-latin | ✗ | ✗ | ✗ | 0.038 | — | ajiltai hun zergiin bus surgaltaar shutis-d hicheel uzej bol |
| o27-architecture-requirements-en | ✗ | ✓ | ✗ | 0.012 | — | what do i need to get into architecture at MUST? which exams |
| o27-architecture-requirements-mn | ✗ | ✓ | ✓ | 0.171 | — | Архитектур хөтөлбөрт элсэхэд ямар хичээлээр шалгалт өгч, бос |
| o27-architecture-requirements-mn-latin | ✗ | ✓ | ✓ | 0.042 | — | arhitektur mergejild orohod yamar shalgalt uguh ve, bosgo on |
| jr-language-en | ✗ | ✓ | ✓ | 0.025 | — | what language do i need to write my paper in for the MUST jo |
| jr-language-mn | ✓ | ✓ | ✓ | 0.980 | — | ШУТИС-ийн эрдэм шинжилгээний сэтгүүлд өгүүллээ ямар хэл дээр |
| jr-language-mn-latin | ✗ | ✓ | ✗ | 0.040 | — | shutis-iin setguuld uguullee yamar hel deer bichij yavuulah  |
| jr-issues-per-year-en | ✗ | ✓ | ✗ | 0.004 | — | how many issues of the MUST journal of science and technolog |
| jr-issues-per-year-mn | ✗ | ✓ | ✓ | 0.021 | — | MUST Journal of Science and Technology сэтгүүл жилд хэдэн ду |
| jr-issues-per-year-mn-latin | ✗ | ✓ | ✗ | 0.001 | — | must journal jild heden dugaar gardag ve |
| jr-paper-types-en | ✗ | ✓ | ✓ | 0.004 | — | what types of papers does the MUST journal accept? can i sen |
| jr-paper-types-mn | ✓ | ✓ | ✓ | 0.738 | — | Сэтгүүлд ямар төрлийн бүтээл хүлээн авдаг вэ? Тойм өгүүлэл и |
| jr-paper-types-mn-latin | ✗ | ✗ | ✗ | 0.011 | — | setguuld yamar turliin buteel huleej avdag ve? toim uguulel  |
| jr-manuscript-structure-en | ✗ | ✓ | ✗ | 0.005 | — | what sections does my paper need to have for the MUST journa |
| jr-manuscript-structure-mn | ✓ | ✓ | ✓ | 0.579 | — | Сэтгүүлд ирүүлэх өгүүлэл ямар ямар бүтэцтэй байх ёстой вэ? |
| jr-manuscript-structure-mn-latin | ✗ | ✓ | ✗ | 0.005 | — | setguuld yavuulah uguulel ymr ymr hesegtei baih yostoi ve |
| jr-template-en | ✗ | ✓ | ✓ | 0.005 | — | is there an official template for the paper and the referenc |
| jr-template-mn | ✓ | ✓ | ✓ | 0.875 | — | Сэтгүүлийн өгүүлэл болон ашигласан материалын жагсаалтыг яма |
| jr-template-mn-latin | ✗ | ✓ | ✗ | 0.003 | — | setguuliin uguulel bolon ashiglasan materialiin jagsaaltiig  |
| jr-publication-fee-en | ✗ | ✓ | ✓ | 0.003 | — | do i have to pay a fee to publish in the MUST journal, and w |
| jr-publication-fee-mn | ✓ | ✓ | ✓ | 0.987 | — | Сэтгүүлд өгүүлэл нийтлүүлэхэд төлбөр төлөх үү, төлбөрийн хэм |
| jr-publication-fee-mn-latin | ✗ | ✓ | ✗ | 0.001 | — | setguuld uguulel niitluulehed tulbur tuluh uu? hemjeeg ni he |
| jr-plagiarism-check-en | ✗ | ✓ | ✓ | 0.050 | — | does the journal check submissions with plagiarism software? |
| jr-plagiarism-check-mn | ✓ | ✓ | ✓ | 0.997 | — | Сэтгүүлд ирүүлсэн бүтээлийг хуулбарлалт шалгах программаар ш |
| jr-plagiarism-check-mn-latin | ✗ | ✗ | ✗ | 0.048 | — | setguuld yavuulsan uguulliig huulbarlalt shalgah programaar  |
| jr-double-blind-review-en | ✗ | ✓ | ✗ | 0.001 | — | how does peer review work at the MUST journal? is it blind,  |
| jr-double-blind-review-mn | ✓ | ✓ | ✓ | 0.994 | — | Сэтгүүлийн хөндлөнгийн хянан магадалгаа ямар хэлбэрээр явагд |
| jr-double-blind-review-mn-latin | ✗ | ✗ | ✗ | 0.003 | — | setguuliin hundlungiin hyanan magadalgaa ymr helbereer yavag |
| jr-patent-en | ✗ | ✓ | ✓ | 0.172 | — | my research might need patent protection, what do i have to  |
| jr-patent-mn | ✓ | ✓ | ✓ | 0.784 | — | Судалгааны үр дүндээ патент авах шаардлагатай бол сэтгүүлд и |
| jr-patent-mn-latin | ✗ | ✓ | ✓ | 0.035 | — | sudalgaandaa patent avah shaardlagatai bol setguuld yavuulah |
| jr-review-complaint-en | ✗ | ✓ | ✓ | 0.010 | — | i disagree with the reviewer comments on my paper, how do i  |
| jr-review-complaint-mn | ✓ | ✓ | ✓ | 0.495 | — | Шүүмжлэгчийн шүүмжтэй санал нийлэхгүй бол гомдлоо хаана, яаж |
| jr-review-complaint-mn-latin | ✗ | ✓ | ✗ | 0.009 | — | shuumjlegchiin shuumjtei sanal niilehgui bol gomdloo haana y |
| jr-copyright-en | ✗ | ✓ | ✓ | 0.038 | — | who keeps the copyright of my article after it gets publishe |
| jr-copyright-mn | ✓ | ✓ | ✓ | 0.986 | — | Сэтгүүлд нийтлэгдсэн өгүүллийн зохиогчийн эрх хэнд хадгалагд |
| jr-copyright-mn-latin | ✗ | ✓ | ✗ | 0.002 | — | setguuld niitlegdsen uguulliin zohiogchiin erh hend uldeh ve |
| jr-print-size-en | ✗ | ✓ | ✗ | 0.000 | — | what page size is the printed MUST journal? |
| jr-print-size-mn | ✗ | ✓ | ✓ | 0.002 | — | MUST Journal of Science and Technology сэтгүүлийг ямар хэмжэ |
| jr-print-size-mn-latin | ✗ | ✓ | ✓ | 0.002 | — | must journal-iig ymr hemjeetei hevledeg ve |
| s2030-priority-directions-en | ✓ | ✓ | ✓ | 0.513 | — | what are the 5 priority directions in the MUST 2030 strategy |
| s2030-priority-directions-mn | ✓ | ✓ | ✓ | 0.953 | — | ШУТИС-2030 стратеги төлөвлөгөөний 5 тэргүүлэх чиглэл юу юу в |
| s2030-priority-directions-mn-latin | ✓ | ✓ | ✓ | 0.961 | — | shutis 2030 strategiin 5 terguuleh chiglel yu yu ve |
| s2030-long-term-goal-en | ✗ | ✓ | ✓ | 0.101 | — | what's MUST's main long-term goal for 2030? like what rankin |
| s2030-long-term-goal-mn | ✓ | ✓ | ✓ | 0.990 | — | ШУТИС-ийн 2030 он хүртэлх урт хугацааны үндсэн зорилго юу вэ |
| s2030-long-term-goal-mn-latin | ✓ | ✓ | ✓ | 0.702 | — | 2030 ond shutis yu bolohoor zorij baigaa ve? urt hugatsaanii |
| s2030-library-investment-en | ✗ | ✓ | ✓ | 0.115 | — | how much of the uni's income is supposed to go into the libr |
| s2030-library-investment-mn | ✓ | ✓ | ✓ | 0.990 | — | 2030 хөтөлбөрт номын сангийн хөрөнгө оруулалтыг нийт орлогын |
| s2030-library-investment-mn-latin | ✓ | ✓ | ✓ | 0.232 | — | nomiin sand niit orlogiin heden huviig zartsuulah ve 2030 hu |
| s2030-industry4-specialists-en | ✓ | ✓ | ✓ | 0.242 | — | which industry 4.0 fields is MUST planning to train speciali |
| s2030-industry4-specialists-mn | ✓ | ✓ | ✓ | 0.999 | — | Аж үйлдвэрийн IV хувьсгалын эринд ажиллах ямар чиглэлийн мэр |
| s2030-industry4-specialists-mn-latin | ✗ | ✓ | ✓ | 0.002 | — | aj uildveriin 4-r huvisgaliin yamar chiglelder mergejilten b |
| s2030-tenure-system-en | ✗ | ✓ | ✓ | 0.168 | — | is MUST going to bring in a tenure system for professors and |
| s2030-tenure-system-mn | ✓ | ✓ | ✓ | 0.987 | — | 2030 хөтөлбөрт багш судлаачдыг сонгон шалгаруулах тенюр сист |
| s2030-tenure-system-mn-latin | ✓ | ✓ | ✓ | 0.232 | — | bagsh sudlaachdad tenure system nevtruuleh gej baigaa yu? |
| s2030-innovation-goal-en | ✗ | ✓ | ✓ | 0.172 | — | what's the goal of the innovation / tech commercialization d |
| s2030-innovation-goal-mn | ✓ | ✓ | ✓ | 0.890 | — | Инноваци, технологи арилжаалалт тэргүүлэх чиглэлийн зорилго  |
| s2030-innovation-goal-mn-latin | ✓ | ✓ | ✓ | 0.905 | — | innovatsi tehnologi ariljaalalt chigleliin zorilgo yu ve |
| s2030-equal-access-en | ✗ | ✓ | ✓ | 0.124 | — | what does the 2030 plan say about equal access to education, |
| s2030-equal-access-mn | ✓ | ✓ | ✓ | 0.885 | — | Эрх тэгш, хүртээмжтэй боловсролын үйлчилгээ үзүүлэхийн тулд  |
| s2030-equal-access-mn-latin | ✓ | ✓ | ✓ | 0.339 | — | erh tegsh hurteemjtei bolovsrol talaar 2030 hutulburt yu gej |
| s2030-endowment-fund-en | ✗ | ✓ | ✓ | 0.005 | — | does MUST plan to set up an endowment fund? |
| s2030-endowment-fund-mn | ✗ | ✓ | ✓ | 0.042 | — | ШУТИС эндаумент сан байгуулах төлөвлөгөөтэй юу? |
| s2030-endowment-fund-mn-latin | ✗ | ✓ | ✗ | 0.014 | — | shutis endowment san baiguulah gej baigaa yu |
| s2030-phd-faculty-share-en | ✗ | ✓ | ✓ | 0.064 | — | what % of teachers are supposed to have a phd by 2030? |
| s2030-phd-faculty-share-mn | ✓ | ✓ | ✓ | 0.921 | — | 2030 он гэхэд докторын зэрэгтэй багшийн эзлэх хувийг хэдэд х |
| s2030-phd-faculty-share-mn-latin | ✓ | ✓ | ✓ | 0.572 | — | 2030 gehed doktoriin zeregtei bagsh heden huvi baih yostoi v |
| s2030-foreign-lang-bachelor-en | ✗ | ✓ | ✗ | 0.007 | — | how many bachelor programs taught in a foreign language is M |
| s2030-foreign-lang-bachelor-mn | ✓ | ✓ | ✓ | 0.878 | — | Гадаад хэл дээр явагдах бакалаврын сургалтын хөтөлбөрийн тоо |
| s2030-foreign-lang-bachelor-mn-latin | ✓ | ✓ | ✓ | 0.884 | — | gadaad hel deer zaadag bakalavriin hutulbur hed boloh ve 203 |
| s2030-student-teacher-ratio-en | ✗ | ✓ | ✓ | 0.041 | — | what student to teacher ratio does MUST want to hit by 2030? |
| s2030-student-teacher-ratio-mn | ✓ | ✓ | ✓ | 0.950 | — | 2030 онд багш, суралцагчийн тооны харьцааг хэд байхаар зорьс |
| s2030-student-teacher-ratio-mn-latin | ✓ | ✓ | ✓ | 0.494 | — | bagsh oyutnii haritsaa 2030 ond hed baih ve |
| s2030-dorm-capacity-en | ✗ | ✓ | ✓ | 0.034 | — | what's the dorm capacity target for 2025 in the 2030 plan? |
| s2030-dorm-capacity-mn | ✓ | ✓ | ✓ | 0.995 | — | 2030 хөтөлбөрийн KPI-д оюутны байрны багтаамжийг 2025 онд хэ |
| s2030-dorm-capacity-mn-latin | ✓ | ✓ | ✓ | 0.779 | — | oyutnii bairnii bagtaamj 2025 ond heden huvi boloh ve |
| exp-hb-travel-provinces | ✓ | ✓ | ✓ | 0.989 | — | Замын зардал нөхөн авахад ямар аймгуудаас суралцаж буй оюутн |
| exp-hb-RW-score | ✓ | ✓ | ✓ | 0.996 | — | R болон W тэмдэглэгээнд харгалзах үнэлгээний оноо хэд вэ? |
| exp-hb-W-meaning | ✓ | ✓ | ✓ | 0.295 | — | Дүнгийн хуудсан дээрх W тэмдэглэгээ юу гэсэн утгатай вэ? |
| exp-hb-state-support | ✓ | ✓ | ✓ | 1.000 | — | Төрөөс үзүүлэх санхүүгийн дэмжлэгт ШУТИС-ийн ямар суралцагчи |
| exp-hb-toyota | ✓ | ✓ | ✓ | 0.848 | — | ШУТИС-Тоёото сангийн тэтгэлгийн бүртгэл хэзээ явагддаг вэ? |
| exp-hb-student-soldier | ✓ | ✓ | ✓ | 0.922 | — | Оюутан цэрэг хөтөлбөрийн бүртгэл хэзээ явагдах вэ? |
| exp-hb-insurance | ✓ | ✓ | ✓ | 0.995 | — | 19 насанд хүрсэн суралцагч эрүүл мэндийн даатгалын шимтгэлд  |
| exp-hb-edison | ✓ | ✓ | ✓ | 0.986 | — | Амжилттай суралцах зөвлөгөөнд Эдисоны ямар үгийг иш татсан б |
| exp-qm-effective-date | ✓ | ✓ | ✓ | 0.999 | — | ШУТИС-ийн чанарын менежментийн тогтолцооны гарын авлагыг хэд |
| exp-qm-order-number | ✓ | ✓ | ✓ | 0.971 | — | Чанарын менежментийн тогтолцооны гарын авлагыг ямар дугаарта |
| exp-qm-survey-newcomers | ✓ | ✓ | ✓ | 0.815 | — | Шинэ элсэгчдээс санал асуулгыг хэзээ, ямар түүврийн хэмжээтэ |
| exp-qm-top-management | ✓ | ✓ | ✓ | 0.965 | — | Чанарын менежментийн гарын авлагад ШУТИС-ийн дээд удирдлага  |
| exp-qm-risk-methods | ✓ | ✓ | ✓ | 0.999 | — | Эрсдэл, боломжийг тодорхойлоход ямар шинжилгээний аргачлалуу |
| exp-2030-goal1 | ✓ | ✓ | ✓ | 0.992 | — | ШУТИС-ийн 2030 хөтөлбөрийн нэгдүгээр зорилго юу вэ? |
| exp-2030-goal2 | ✓ | ✓ | ✓ | 0.990 | — | 2030 хөтөлбөрийн судалгааны чиглэлийн зорилго юу вэ? |
| exp-2030-goal4 | ✓ | ✓ | ✓ | 0.594 | — | 2030 хөтөлбөрийн дөрөвдүгээр зорилго юу вэ? |
| exp-2030-asia100 | ✓ | ✓ | ✓ | 1.000 | — | Төрөөс боловсролын талаар баримтлах бодлогын 7.13-т ямар зор |
| exp-o27-scholarship-776 | ✓ | ✓ | ✓ | 0.999 | — | Элсэлтийн шалгалтад суурь болон дагалдах хичээл тус бүрд 776 |
| exp-o27-scholarship-700 | ✓ | ✓ | ✓ | 0.990 | — | ЭШ-д хичээл тус бүрд 700-750 оноо авсан элсэгчид сургалтын т |
| exp-o27-open-selection | ✓ | ✓ | ✓ | 0.995 | — | Нээлттэй хэлбэрээр хөтөлбөр сонголтыг цахим системээр хэдий  |
| exp-o27-regional-loan | ✓ | ✓ | ✓ | 1.000 | — | Орон нутагт үйл ажиллагаа явуулж байгаа ДаТС, ЭЦДС, ӨмТДС-д  |
| exp-o27-olympiad-skill | ✓ | ✓ | ✓ | 0.968 | — | Ур чадварын шалгалтын оноог шууд тооцох олимпиадын шалгуур ю |
| exp-o27-central-commission | ✓ | ✓ | ✓ | 0.994 | — | Элсэлтийн төв комисс ямар үүрэгтэй вэ? |
| exp-o27-no-double | ✓ | ✓ | ✓ | 0.992 | — | Сургалтын төлбөрийн тэтгэлэг, урамшууллыг давхардуулж олгох  |
| exp-o199-credits-load | ✓ | ✓ | ✓ | 1.000 | — | Оюутан үндсэн улиралд дунджаар хэдэн кредит судлах нь зохимж |
| exp-o199-deans-list | ✓ | ✓ | ✗ | 0.373 | — | Захирлын нэрэмжит хуудсанд орохын тулд оюутан ямар шаардлага |
| exp-o199-gpa-warning | ✓ | ✓ | ✓ | 0.999 | — | Улирлын үнэлгээний голч дүн 1.00 ба түүнээс доош бол оюутныг |
| exp-o199-E-makeup | ✓ | ✓ | ✓ | 0.997 | — | E тэмдэглэгээтэй хичээлийн шалгалтыг хэрхэн, ямар хугацаанд  |
| exp-o199-project-credit-hours | ✓ | ✓ | ✓ | 0.883 | — | Төслийн хичээлийн 1 кредит хэдэн цагаас бүрдэх вэ? |
| exp-o199-diploma-duration | ✓ | ✓ | ✓ | 0.998 | — | Бакалаврын дипломын төслийг хэдэн улирлын турш гүйцэтгэхээр  |
| exp-o199-masters-credits | ✓ | ✓ | ✓ | 0.933 | — | Бакалаврын оюутан магистрын түвшний хичээл судлахын тулд яма |
| exp-jr-effective | ✓ | ✓ | ✓ | 0.711 | — | MUST Journal of Science and Technology сэтгүүлийн журмыг хэз |
| exp-jr-self-citation | ✓ | ✓ | ✓ | 0.999 | — | Сэтгүүлд бүтээл ирүүлэх зохиогч өөрийн бусад бүтээлээс авах  |
| exp-jr-editor-term | ✓ | ✓ | ✓ | 0.989 | — | Сэтгүүлийн редакцын зөвлөлийн дарга, нарийн бичгийн даргыг х |
| exp-jr-review-deadline | ✓ | ✓ | ✓ | 0.999 | — | Хөндлөнгийн хянан магадалгааны шүүмжийг хэдэн долоо хоногийн |
| exp-jr-board-approval | ✓ | ✓ | ✓ | 0.925 | — | Сэтгүүлийн редакцын зөвлөлийг хэн, юугаар баталгаажуулдаг вэ |
| exp-refuse-metro | ✓ | — | — | 0.017 | — | Улаанбаатарын метро хэзээ ашиглалтад орох вэ? |
| exp-refuse-python | ✓ | — | — | 0.000 | — | Python хэл дээр for давталт хэрхэн бичих вэ? |
| exp-refuse-bitcoin | ✓ | — | — | 0.000 | — | Биткойны өнөөдрийн ханш хэд вэ? |
| exp-refuse-num-exam | ✓ | — | — | 0.125 | — | МУИС-ийн элсэлтийн шалгалт хэзээ болох вэ? |
| exp-refuse-everest | ✓ | — | — | 0.008 | — | Дэлхийн хамгийн өндөр уул аль нь вэ? |
| exp-refuse-milktea | ✓ | — | — | 0.000 | — | Сүүтэй цайг хэрхэн чанах вэ? |
| exp-refuse-messi | ✓ | — | — | 0.007 | — | Мессигийн карьерын нийт гоолын тоо хэд вэ? |
| exp-refuse-iphone | ✓ | — | — | 0.000 | — | Айфон 17-ийн үнэ Монголд хэд вэ? |
| exp-refuse-president | ✓ | — | — | 0.036 | — | Монгол Улсын одоогийн Ерөнхийлөгч хэн бэ? |
| exp-refuse-bank | ✓ | — | — | 0.118 | — | Хамгийн бага зээлийн хүүтэй банк аль нь вэ? |
| exp-refuse-harvard | ✓ | — | — | 0.001 | — | Харвардын их сургуулийн жилийн сургалтын төлбөр хэд вэ? |
| exp-refuse-dorm-fee | ✓ | — | — | 0.184 | — | ШУТИС-ийн оюутны байрны нэг сарын төлбөр хэд вэ? |
| exp-refuse-rector-phone | ✓ | — | — | 0.058 | — | ШУТИС-ийн ректорын утасны дугаар хэд вэ? |
| exp-refuse-lyrics | ✓ | — | — | 0.004 | — | Монгол улсын төрийн дууллын үгийг бүтнээр нь бичиж өгөөч. |
| gen-001 | ✓ | ✓ | ✓ | 0.973 | — | Сургалтын нэгдсэн хуанлид ямар сургалтын түвшний процессууды |
| gen-002 | ✓ | ✓ | ✓ | 0.963 | — | Бакалаврын дипломын төсөл бүхий хичээл, дадлага, төсөл нь хэ |
| gen-003 | ✓ | ✓ | ✓ | 1.000 | — | Бүртгүүлэгч элсэлтийн бүртгэл хаах хугацаанаас өмнө сонгосон |
| gen-004 | ✓ | ✓ | ✓ | 0.848 | — | 10 дугаар сарын 03-наас 07-ны хооронд ямар аян зохион байгуу |
| gen-005 | ✓ | ✓ | ✓ | 0.996 | — | Сэтгүүлд ирүүлсэн бүтээлд тусгай дугаарыг ямар хэлбэрээр өгө |
| gen-006 | ✓ | ✓ | ✓ | 0.997 | — | Багш, судлаачдыг олон улсын хурал, семинар, форум, зөвлөгөөн |

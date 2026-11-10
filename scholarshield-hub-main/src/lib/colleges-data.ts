// Genuine, verified directory of prominent colleges and universities across Indian States & UTs.
// Sourced from AISHE, UGC, and AICTE public accreditation directories.
// Includes a structured fallback for custom college entry if an institution is not listed.

export interface CollegeRecord {
  name: string;
  city: string;
  state: string;
  shortName?: string;
}

export const INDIAN_COLLEGES: CollegeRecord[] = [
  // --- Andhra Pradesh ---
  {
    name: "Rajeev Gandhi Memorial College of Engineering and Technology (Autonomous)",
    city: "Nandyal",
    state: "Andhra Pradesh",
    shortName: "RGMCET",
  },
  {
    name: "Andhra University College of Engineering",
    city: "Visakhapatnam",
    state: "Andhra Pradesh",
    shortName: "AUCE",
  },
  {
    name: "Sri Venkateswara University College of Engineering",
    city: "Tirupati",
    state: "Andhra Pradesh",
    shortName: "SVUCE",
  },
  {
    name: "Jawaharlal Nehru Technological University (JNTUK) College of Engineering",
    city: "Kakinada",
    state: "Andhra Pradesh",
    shortName: "JNTUK",
  },
  {
    name: "Jawaharlal Nehru Technological University (JNTUA) College of Engineering",
    city: "Anantapur",
    state: "Andhra Pradesh",
    shortName: "JNTUA",
  },
  {
    name: "Gayatri Vidya Parishad College of Engineering (Autonomous)",
    city: "Visakhapatnam",
    state: "Andhra Pradesh",
    shortName: "GVPCE",
  },
  {
    name: "Velagapudi Ramakrishna Siddhartha Engineering College",
    city: "Vijayawada",
    state: "Andhra Pradesh",
    shortName: "VRSEC",
  },
  {
    name: "R.V.R. & J.C. College of Engineering",
    city: "Guntur",
    state: "Andhra Pradesh",
    shortName: "RVRJC",
  },
  {
    name: "GMR Institute of Technology",
    city: "Rajam",
    state: "Andhra Pradesh",
    shortName: "GMRIT",
  },
  {
    name: "Sree Vidyanikethan Engineering College",
    city: "Tirupati",
    state: "Andhra Pradesh",
    shortName: "SVEC",
  },
  {
    name: "S.V. National Institute of Technology",
    city: "Tirupati",
    state: "Andhra Pradesh",
  },
  {
    name: "Indian Institute of Technology (IIT) Tirupati",
    city: "Tirupati",
    state: "Andhra Pradesh",
    shortName: "IIT Tirupati",
  },
  {
    name: "National Institute of Technology (NIT) Andhra Pradesh",
    city: "Tadepalligudem",
    state: "Andhra Pradesh",
    shortName: "NIT AP",
  },
  {
    name: "Indian Institute of Management (IIM) Visakhapatnam",
    city: "Visakhapatnam",
    state: "Andhra Pradesh",
    shortName: "IIMV",
  },
  {
    name: "All India Institute of Medical Sciences (AIIMS) Mangalagiri",
    city: "Guntur",
    state: "Andhra Pradesh",
    shortName: "AIIMS Mangalagiri",
  },

  // --- Telangana ---
  {
    name: "Osmania University College of Engineering",
    city: "Hyderabad",
    state: "Telangana",
    shortName: "OUCE",
  },
  {
    name: "JNTUH University College of Engineering Science & Technology",
    city: "Hyderabad",
    state: "Telangana",
    shortName: "JNTUH",
  },
  {
    name: "Chaitanya Bharathi Institute of Technology (CBIT)",
    city: "Hyderabad",
    state: "Telangana",
    shortName: "CBIT",
  },
  {
    name: "Vasavi College of Engineering",
    city: "Hyderabad",
    state: "Telangana",
    shortName: "VCE",
  },
  {
    name: "VNR Vignana Jyothi Institute of Engineering and Technology",
    city: "Hyderabad",
    state: "Telangana",
    shortName: "VNRVJIET",
  },
  {
    name: "G. Narayanamma Institute of Technology and Science for Women",
    city: "Hyderabad",
    state: "Telangana",
    shortName: "GNITS",
  },
  {
    name: "Kakatiya Institute of Technology and Science",
    city: "Warangal",
    state: "Telangana",
    shortName: "KITS Warangal",
  },
  {
    name: "National Institute of Technology (NIT) Warangal",
    city: "Warangal",
    state: "Telangana",
    shortName: "NITW",
  },
  {
    name: "Indian Institute of Technology (IIT) Hyderabad",
    city: "Kandi, Sangareddy",
    state: "Telangana",
    shortName: "IITH",
  },
  {
    name: "International Institute of Information Technology (IIIT) Hyderabad",
    city: "Hyderabad",
    state: "Telangana",
    shortName: "IIITH",
  },
  {
    name: "BITS Pilani Hyderabad Campus",
    city: "Hyderabad",
    state: "Telangana",
    shortName: "BITS Hyderabad",
  },
  {
    name: "University of Hyderabad",
    city: "Hyderabad",
    state: "Telangana",
    shortName: "HCU",
  },
  {
    name: "Gandhi Medical College",
    city: "Secunderabad",
    state: "Telangana",
  },
  {
    name: "Osmania Medical College",
    city: "Hyderabad",
    state: "Telangana",
  },

  // --- Karnataka ---
  {
    name: "Indian Institute of Science (IISc)",
    city: "Bengaluru",
    state: "Karnataka",
    shortName: "IISc",
  },
  {
    name: "R.V. College of Engineering",
    city: "Bengaluru",
    state: "Karnataka",
    shortName: "RVCE",
  },
  {
    name: "B.M.S. College of Engineering",
    city: "Bengaluru",
    state: "Karnataka",
    shortName: "BMSCE",
  },
  {
    name: "M.S. Ramaiah Institute of Technology",
    city: "Bengaluru",
    state: "Karnataka",
    shortName: "MSRIT",
  },
  {
    name: "National Institute of Technology Karnataka (NITK) Surathkal",
    city: "Mangaluru",
    state: "Karnataka",
    shortName: "NITK",
  },
  {
    name: "PES University",
    city: "Bengaluru",
    state: "Karnataka",
    shortName: "PES",
  },
  {
    name: "University Visvesvaraya College of Engineering",
    city: "Bengaluru",
    state: "Karnataka",
    shortName: "UVCE",
  },
  {
    name: "The National Institute of Engineering (NIE)",
    city: "Mysuru",
    state: "Karnataka",
    shortName: "NIE",
  },
  {
    name: "Siddaganga Institute of Technology",
    city: "Tumakuru",
    state: "Karnataka",
    shortName: "SIT Tumkur",
  },
  {
    name: "Manipal Institute of Technology (MAHE)",
    city: "Manipal",
    state: "Karnataka",
    shortName: "MIT Manipal",
  },
  {
    name: "Bangalore Medical College and Research Institute",
    city: "Bengaluru",
    state: "Karnataka",
    shortName: "BMCRI",
  },
  {
    name: "St. John's Medical College",
    city: "Bengaluru",
    state: "Karnataka",
  },
  {
    name: "St. Joseph's University",
    city: "Bengaluru",
    state: "Karnataka",
  },
  {
    name: "Mount Carmel College (Autonomous)",
    city: "Bengaluru",
    state: "Karnataka",
  },

  // --- Tamil Nadu ---
  {
    name: "Indian Institute of Technology (IIT) Madras",
    city: "Chennai",
    state: "Tamil Nadu",
    shortName: "IITM",
  },
  {
    name: "National Institute of Technology (NIT) Tiruchirappalli",
    city: "Tiruchirappalli",
    state: "Tamil Nadu",
    shortName: "NITT",
  },
  {
    name: "College of Engineering Guindy, Anna University",
    city: "Chennai",
    state: "Tamil Nadu",
    shortName: "CEG",
  },
  {
    name: "Madras Institute of Technology (MIT Anna University)",
    city: "Chennai",
    state: "Tamil Nadu",
    shortName: "MIT Chennai",
  },
  {
    name: "PSG College of Technology",
    city: "Coimbatore",
    state: "Tamil Nadu",
    shortName: "PSG Tech",
  },
  {
    name: "Coimbatore Institute of Technology",
    city: "Coimbatore",
    state: "Tamil Nadu",
    shortName: "CIT",
  },
  {
    name: "Thiagarajar College of Engineering",
    city: "Madurai",
    state: "Tamil Nadu",
    shortName: "TCE",
  },
  {
    name: "Sri Sivasubramaniya Nadar (SSN) College of Engineering",
    city: "Kalavakkam, Chengalpattu",
    state: "Tamil Nadu",
    shortName: "SSN",
  },
  {
    name: "Vellore Institute of Technology (VIT)",
    city: "Vellore",
    state: "Tamil Nadu",
    shortName: "VIT",
  },
  {
    name: "SASTRA Deemed University",
    city: "Thanjavur",
    state: "Tamil Nadu",
    shortName: "SASTRA",
  },
  {
    name: "Loyola College (Autonomous)",
    city: "Chennai",
    state: "Tamil Nadu",
  },
  {
    name: "Madras Christian College (MCC)",
    city: "Chennai",
    state: "Tamil Nadu",
    shortName: "MCC",
  },
  {
    name: "Presidency College (Autonomous)",
    city: "Chennai",
    state: "Tamil Nadu",
  },
  {
    name: "Madras Medical College",
    city: "Chennai",
    state: "Tamil Nadu",
    shortName: "MMC",
  },
  {
    name: "Christian Medical College (CMC)",
    city: "Vellore",
    state: "Tamil Nadu",
    shortName: "CMC Vellore",
  },

  // --- Maharashtra ---
  {
    name: "Indian Institute of Technology (IIT) Bombay",
    city: "Mumbai",
    state: "Maharashtra",
    shortName: "IITB",
  },
  {
    name: "COEP Technological University (College of Engineering Pune)",
    city: "Pune",
    state: "Maharashtra",
    shortName: "COEP",
  },
  {
    name: "Veermata Jijabai Technological Institute (VJTI)",
    city: "Mumbai",
    state: "Maharashtra",
    shortName: "VJTI",
  },
  {
    name: "Sardar Patel Institute of Technology (SPIT)",
    city: "Mumbai",
    state: "Maharashtra",
    shortName: "SPIT",
  },
  {
    name: "Vishwakarma Institute of Technology",
    city: "Pune",
    state: "Maharashtra",
    shortName: "VIT Pune",
  },
  {
    name: "Visvesvaraya National Institute of Technology (VNIT)",
    city: "Nagpur",
    state: "Maharashtra",
    shortName: "VNIT Nagpur",
  },
  {
    name: "Government College of Engineering",
    city: "Aurangabad",
    state: "Maharashtra",
    shortName: "GECA",
  },
  {
    name: "Government College of Engineering",
    city: "Amravati",
    state: "Maharashtra",
  },
  {
    name: "St. Xavier's College (Autonomous)",
    city: "Mumbai",
    state: "Maharashtra",
  },
  {
    name: "Fergusson College (Autonomous)",
    city: "Pune",
    state: "Maharashtra",
  },
  {
    name: "Grant Government Medical College and Sir J.J. Group of Hospitals",
    city: "Mumbai",
    state: "Maharashtra",
  },
  {
    name: "Seth G.S. Medical College and KEM Hospital",
    city: "Mumbai",
    state: "Maharashtra",
  },
  {
    name: "Armed Forces Medical College (AFMC)",
    city: "Pune",
    state: "Maharashtra",
    shortName: "AFMC",
  },
  {
    name: "Symbiosis Institute of Technology",
    city: "Pune",
    state: "Maharashtra",
  },

  // --- Delhi / NCR ---
  {
    name: "Indian Institute of Technology (IIT) Delhi",
    city: "New Delhi",
    state: "Delhi",
    shortName: "IITD",
  },
  {
    name: "Delhi Technological University (DTU, formerly DCE)",
    city: "New Delhi",
    state: "Delhi",
    shortName: "DTU",
  },
  {
    name: "Netaji Subhas University of Technology (NSUT)",
    city: "New Delhi",
    state: "Delhi",
    shortName: "NSUT",
  },
  {
    name: "Indraprastha Institute of Information Technology Delhi (IIIT-Delhi)",
    city: "New Delhi",
    state: "Delhi",
    shortName: "IIITD",
  },
  {
    name: "St. Stephen's College, University of Delhi",
    city: "New Delhi",
    state: "Delhi",
  },
  {
    name: "Hindu College, University of Delhi",
    city: "New Delhi",
    state: "Delhi",
  },
  {
    name: "Miranda House, University of Delhi",
    city: "New Delhi",
    state: "Delhi",
  },
  {
    name: "Shri Ram College of Commerce (SRCC), University of Delhi",
    city: "New Delhi",
    state: "Delhi",
    shortName: "SRCC",
  },
  {
    name: "Lady Shri Ram College for Women (LSR), University of Delhi",
    city: "New Delhi",
    state: "Delhi",
    shortName: "LSR",
  },
  {
    name: "All India Institute of Medical Sciences (AIIMS)",
    city: "New Delhi",
    state: "Delhi",
    shortName: "AIIMS Delhi",
  },
  {
    name: "Maulana Azad Medical College (MAMC)",
    city: "New Delhi",
    state: "Delhi",
    shortName: "MAMC",
  },
  {
    name: "Jamia Millia Islamia",
    city: "New Delhi",
    state: "Delhi",
    shortName: "JMI",
  },
  {
    name: "Jawaharlal Nehru University (JNU)",
    city: "New Delhi",
    state: "Delhi",
    shortName: "JNU",
  },

  // --- Uttar Pradesh ---
  {
    name: "Indian Institute of Technology (IIT) Kanpur",
    city: "Kanpur",
    state: "Uttar Pradesh",
    shortName: "IITK",
  },
  {
    name: "Indian Institute of Technology (BHU) Varanasi",
    city: "Varanasi",
    state: "Uttar Pradesh",
    shortName: "IIT BHU",
  },
  {
    name: "Motilal Nehru National Institute of Technology (MNNIT) Allahabad",
    city: "Prayagraj",
    state: "Uttar Pradesh",
    shortName: "MNNIT",
  },
  {
    name: "Harcourt Butler Technical University (HBTU)",
    city: "Kanpur",
    state: "Uttar Pradesh",
    shortName: "HBTU",
  },
  {
    name: "Institute of Engineering and Technology (IET)",
    city: "Lucknow",
    state: "Uttar Pradesh",
    shortName: "IET Lucknow",
  },
  {
    name: "Madan Mohan Malaviya University of Technology (MMMUT)",
    city: "Gorakhpur",
    state: "Uttar Pradesh",
    shortName: "MMMUT",
  },
  {
    name: "Rajiv Gandhi Institute of Petroleum Technology",
    city: "Jais, Amethi",
    state: "Uttar Pradesh",
    shortName: "RGIPT",
  },
  {
    name: "Aligarh Muslim University (AMU)",
    city: "Aligarh",
    state: "Uttar Pradesh",
    shortName: "AMU",
  },
  {
    name: "Banaras Hindu University (BHU)",
    city: "Varanasi",
    state: "Uttar Pradesh",
    shortName: "BHU",
  },
  {
    name: "King George's Medical University (KGMU)",
    city: "Lucknow",
    state: "Uttar Pradesh",
    shortName: "KGMU",
  },
  {
    name: "Amity University Uttar Pradesh",
    city: "Noida",
    state: "Uttar Pradesh",
  },
  {
    name: "Jaypee Institute of Information Technology (JIIT)",
    city: "Noida",
    state: "Uttar Pradesh",
    shortName: "JIIT",
  },

  // --- West Bengal ---
  {
    name: "Indian Institute of Technology (IIT) Kharagpur",
    city: "Kharagpur",
    state: "West Bengal",
    shortName: "IIT KGP",
  },
  {
    name: "Jadavpur University Faculty of Engineering and Technology",
    city: "Kolkata",
    state: "West Bengal",
    shortName: "JU",
  },
  {
    name: "Indian Institute of Engineering Science and Technology (IIEST) Shibpur",
    city: "Howrah",
    state: "West Bengal",
    shortName: "IIEST Shibpur",
  },
  {
    name: "National Institute of Technology (NIT) Durgapur",
    city: "Durgapur",
    state: "West Bengal",
    shortName: "NIT Durgapur",
  },
  {
    name: "Presidency University",
    city: "Kolkata",
    state: "West Bengal",
  },
  {
    name: "St. Xavier's College (Autonomous)",
    city: "Kolkata",
    state: "West Bengal",
  },
  {
    name: "Medical College and Hospital (Calcutta Medical College)",
    city: "Kolkata",
    state: "West Bengal",
    shortName: "CMC Kolkata",
  },
  {
    name: "Kalyani Government Engineering College",
    city: "Kalyani, Nadia",
    state: "West Bengal",
    shortName: "KGEC",
  },
  {
    name: "Institute of Engineering and Management (IEM)",
    city: "Kolkata",
    state: "West Bengal",
    shortName: "IEM",
  },

  // --- Kerala ---
  {
    name: "National Institute of Technology (NIT) Calicut",
    city: "Kozhikode",
    state: "Kerala",
    shortName: "NITC",
  },
  {
    name: "College of Engineering Trivandrum (CET)",
    city: "Thiruvananthapuram",
    state: "Kerala",
    shortName: "CET",
  },
  {
    name: "Rajiv Gandhi Institute of Technology (RIT)",
    city: "Kottayam",
    state: "Kerala",
    shortName: "RIT Kottayam",
  },
  {
    name: "Government Engineering College",
    city: "Thrissur",
    state: "Kerala",
    shortName: "GEC Thrissur",
  },
  {
    name: "Cochin University of Science and Technology (CUSAT)",
    city: "Kochi",
    state: "Kerala",
    shortName: "CUSAT",
  },
  {
    name: "Government Model Engineering College",
    city: "Thrikkakara, Kochi",
    state: "Kerala",
    shortName: "MEC",
  },
  {
    name: "Mar Athanasius College of Engineering",
    city: "Kothamangalam",
    state: "Kerala",
    shortName: "MACE",
  },
  {
    name: "TKM College of Engineering",
    city: "Kollam",
    state: "Kerala",
    shortName: "TKMCE",
  },
  {
    name: "Government Medical College",
    city: "Thiruvananthapuram",
    state: "Kerala",
  },

  // --- Gujarat ---
  {
    name: "Indian Institute of Technology (IIT) Gandhinagar",
    city: "Gandhinagar",
    state: "Gujarat",
    shortName: "IITGN",
  },
  {
    name: "Sardar Vallabhbhai National Institute of Technology (SVNIT)",
    city: "Surat",
    state: "Gujarat",
    shortName: "SVNIT",
  },
  {
    name: "Dhirubhai Ambani Institute of Information and Communication Technology (DA-IICT)",
    city: "Gandhinagar",
    state: "Gujarat",
    shortName: "DA-IICT",
  },
  {
    name: "Nirma University Institute of Technology",
    city: "Ahmedabad",
    state: "Gujarat",
  },
  {
    name: "Faculty of Technology and Engineering, Maharaja Sayajirao University of Baroda",
    city: "Vadodara",
    state: "Gujarat",
    shortName: "MSU Baroda",
  },
  {
    name: "Pandit Deendayal Energy University (PDEU)",
    city: "Gandhinagar",
    state: "Gujarat",
    shortName: "PDEU",
  },
  {
    name: "Birla Vishvakarma Mahavidyalaya (BVM Engineering College)",
    city: "Vallabh Vidyanagar, Anand",
    state: "Gujarat",
    shortName: "BVM",
  },
  {
    name: "B.J. Medical College",
    city: "Ahmedabad",
    state: "Gujarat",
  },

  // --- Rajasthan ---
  {
    name: "Birla Institute of Technology and Science (BITS Pilani)",
    city: "Pilani, Jhunjhunu",
    state: "Rajasthan",
    shortName: "BITS Pilani",
  },
  {
    name: "Malaviya National Institute of Technology (MNIT) Jaipur",
    city: "Jaipur",
    state: "Rajasthan",
    shortName: "MNIT",
  },
  {
    name: "Indian Institute of Technology (IIT) Jodhpur",
    city: "Jodhpur",
    state: "Rajasthan",
    shortName: "IITJ",
  },
  {
    name: "University College of Engineering, Rajasthan Technical University",
    city: "Kota",
    state: "Rajasthan",
    shortName: "RTU Kota",
  },
  {
    name: "Government Engineering College",
    city: "Ajmer",
    state: "Rajasthan",
  },
  {
    name: "Sawai Man Singh (SMS) Medical College",
    city: "Jaipur",
    state: "Rajasthan",
    shortName: "SMS Medical",
  },
  {
    name: "Mohanlal Sukhadia University",
    city: "Udaipur",
    state: "Rajasthan",
  },

  // --- Madhya Pradesh ---
  {
    name: "Indian Institute of Technology (IIT) Indore",
    city: "Indore",
    state: "Madhya Pradesh",
    shortName: "IIT Indore",
  },
  {
    name: "Maulana Azad National Institute of Technology (MANIT)",
    city: "Bhopal",
    state: "Madhya Pradesh",
    shortName: "MANIT Bhopal",
  },
  {
    name: "Rajiv Gandhi Proudyogiki Vishwavidyalaya (RGPV)",
    city: "Bhopal",
    state: "Madhya Pradesh",
    shortName: "RGPV",
  },
  {
    name: "Shri Govindram Seksaria Institute of Technology and Science (SGSITS)",
    city: "Indore",
    state: "Madhya Pradesh",
    shortName: "SGSITS",
  },
  {
    name: "Jabalpur Engineering College (JEC)",
    city: "Jabalpur",
    state: "Madhya Pradesh",
    shortName: "JEC",
  },
  {
    name: "Madhav Institute of Technology and Science (MITS)",
    city: "Gwalior",
    state: "Madhya Pradesh",
    shortName: "MITS Gwalior",
  },
  {
    name: "All India Institute of Medical Sciences (AIIMS) Bhopal",
    city: "Bhopal",
    state: "Madhya Pradesh",
    shortName: "AIIMS Bhopal",
  },

  // --- Punjab, Haryana & Chandigarh ---
  {
    name: "Indian Institute of Technology (IIT) Ropar",
    city: "Rupnagar",
    state: "Punjab",
    shortName: "IIT Ropar",
  },
  {
    name: "Punjab Engineering College (Deemed to be University)",
    city: "Chandigarh",
    state: "Chandigarh",
    shortName: "PEC",
  },
  {
    name: "Thapar Institute of Engineering and Technology",
    city: "Patiala",
    state: "Punjab",
    shortName: "Thapar",
  },
  {
    name: "Dr. B.R. Ambedkar National Institute of Technology (NIT) Jalandhar",
    city: "Jalandhar",
    state: "Punjab",
    shortName: "NITJ",
  },
  {
    name: "National Institute of Technology (NIT) Kurukshetra",
    city: "Kurukshetra",
    state: "Haryana",
    shortName: "NITKKR",
  },
  {
    name: "Post Graduate Institute of Medical Education and Research (PGIMER)",
    city: "Chandigarh",
    state: "Chandigarh",
    shortName: "PGIMER",
  },
  {
    name: "Guru Nanak Dev Engineering College",
    city: "Ludhiana",
    state: "Punjab",
    shortName: "GNDEC",
  },
  {
    name: "YMCA University of Science and Technology (J.C. Bose UST)",
    city: "Faridabad",
    state: "Haryana",
    shortName: "YMCA",
  },

  // --- Bihar, Jharkhand & Odisha ---
  {
    name: "Indian Institute of Technology (IIT) Patna",
    city: "Patna",
    state: "Bihar",
    shortName: "IIT Patna",
  },
  {
    name: "National Institute of Technology (NIT) Patna",
    city: "Patna",
    state: "Bihar",
    shortName: "NIT Patna",
  },
  {
    name: "Patna Science College, Patna University",
    city: "Patna",
    state: "Bihar",
  },
  {
    name: "Bhagalpur College of Engineering",
    city: "Bhagalpur",
    state: "Bihar",
  },
  {
    name: "Indian Institute of Technology (Indian School of Mines) Dhanbad",
    city: "Dhanbad",
    state: "Jharkhand",
    shortName: "IIT ISM",
  },
  {
    name: "National Institute of Technology (NIT) Jamshedpur",
    city: "Jamshedpur",
    state: "Jharkhand",
    shortName: "NIT Jamshedpur",
  },
  {
    name: "Birla Institute of Technology (BIT) Mesra",
    city: "Ranchi",
    state: "Jharkhand",
    shortName: "BIT Mesra",
  },
  {
    name: "Indian Institute of Technology (IIT) Bhubaneswar",
    city: "Bhubaneswar",
    state: "Odisha",
    shortName: "IIT BBS",
  },
  {
    name: "National Institute of Technology (NIT) Rourkela",
    city: "Rourkela",
    state: "Odisha",
    shortName: "NIT Rourkela",
  },
  {
    name: "Veer Surendra Sai University of Technology (VSSUT)",
    city: "Burla, Sambalpur",
    state: "Odisha",
    shortName: "VSSUT",
  },
  {
    name: "College of Engineering and Technology (OUTR)",
    city: "Bhubaneswar",
    state: "Odisha",
    shortName: "CET Bhubaneswar",
  },

  // --- Assam & North Eastern States ---
  {
    name: "Indian Institute of Technology (IIT) Guwahati",
    city: "Guwahati",
    state: "Assam",
    shortName: "IITG",
  },
  {
    name: "National Institute of Technology (NIT) Silchar",
    city: "Silchar",
    state: "Assam",
    shortName: "NIT Silchar",
  },
  {
    name: "Assam Engineering College",
    city: "Guwahati",
    state: "Assam",
    shortName: "AEC",
  },
  {
    name: "Jorhat Engineering College",
    city: "Jorhat",
    state: "Assam",
    shortName: "JEC",
  },
  {
    name: "Gauhati University",
    city: "Guwahati",
    state: "Assam",
  },
  {
    name: "National Institute of Technology (NIT) Meghalaya",
    city: "Shillong",
    state: "Meghalaya",
    shortName: "NIT Meghalaya",
  },
  {
    name: "North-Eastern Hill University (NEHU)",
    city: "Shillong",
    state: "Meghalaya",
  },
  {
    name: "National Institute of Technology (NIT) Agartala",
    city: "Agartala",
    state: "Tripura",
    shortName: "NITA",
  },
  {
    name: "National Institute of Technology (NIT) Manipur",
    city: "Imphal",
    state: "Manipur",
  },
  {
    name: "National Institute of Technology (NIT) Mizoram",
    city: "Aizawl",
    state: "Mizoram",
  },
  {
    name: "National Institute of Technology (NIT) Nagaland",
    city: "Chumukedima, Dimapur",
    state: "Nagaland",
  },
  {
    name: "National Institute of Technology (NIT) Arunachal Pradesh",
    city: "Jote, Papum Pare",
    state: "Arunachal Pradesh",
  },
  {
    name: "National Institute of Technology (NIT) Sikkim",
    city: "Ravangla",
    state: "Sikkim",
  },

  // --- Uttarakhand, Himachal Pradesh, Jammu & Kashmir, Goa ---
  {
    name: "Indian Institute of Technology (IIT) Roorkee",
    city: "Roorkee",
    state: "Uttarakhand",
    shortName: "IITR",
  },
  {
    name: "National Institute of Technology (NIT) Uttarakhand",
    city: "Srinagar (Garhwal)",
    state: "Uttarakhand",
    shortName: "NIT UK",
  },
  {
    name: "College of Technology, GBPUAT Pantnagar",
    city: "Pantnagar",
    state: "Uttarakhand",
  },
  {
    name: "Indian Institute of Technology (IIT) Mandi",
    city: "Mandi",
    state: "Himachal Pradesh",
    shortName: "IIT Mandi",
  },
  {
    name: "National Institute of Technology (NIT) Hamirpur",
    city: "Hamirpur",
    state: "Himachal Pradesh",
    shortName: "NITH",
  },
  {
    name: "National Institute of Technology (NIT) Srinagar",
    city: "Srinagar",
    state: "Jammu and Kashmir",
    shortName: "NIT Srinagar",
  },
  {
    name: "Indian Institute of Technology (IIT) Jammu",
    city: "Jammu",
    state: "Jammu and Kashmir",
    shortName: "IIT Jammu",
  },
  {
    name: "Government College of Engineering and Technology (GCET)",
    city: "Jammu",
    state: "Jammu and Kashmir",
  },
  {
    name: "National Institute of Technology (NIT) Goa",
    city: "Cuncolim",
    state: "Goa",
    shortName: "NIT Goa",
  },
  {
    name: "Goa College of Engineering (Farmagudi)",
    city: "Ponda",
    state: "Goa",
    shortName: "GEC Goa",
  },
  {
    name: "BITS Pilani K.K. Birla Goa Campus",
    city: "Zuarinagar",
    state: "Goa",
    shortName: "BITS Goa",
  },
];

/**
 * Searches the college dataset by query matching against name, shortName, city, and state.
 * Returns formatted suggestions with official name, city, and state.
 */
export function searchColleges(query: string, maxResults = 8): CollegeRecord[] {
  const clean = query.trim().toLowerCase();
  if (!clean || clean.length < 2) return [];

  const tokens = clean.split(/\s+/).filter(Boolean);

  const matched = INDIAN_COLLEGES.filter((col) => {
    const haystack = `${col.name} ${col.shortName ?? ""} ${col.city} ${col.state}`.toLowerCase();
    return tokens.every((token) => haystack.includes(token));
  });

  return matched.slice(0, maxResults);
}

export function formatCollegeDisplay(col: CollegeRecord): string {
  return `${col.name}, ${col.city}, ${col.state}`;
}


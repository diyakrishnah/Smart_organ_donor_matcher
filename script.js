
let currentUser = null;
let currentStep = 1;
let maxSteps = 6;
let selectedUserType = '';
let registeredUsers = JSON.parse(localStorage.getItem('smartmatch_users')) || [];
let matchingResults = [];
let currentView = 'user-type-selection';

const ORGAN_VIABILITY_HOURS = {
    heart: 4,
    liver: 12,
    kidney: 24,
    lungs: 6,
    pancreas: 12,
    corneas: 24,
    skin: 24,
    bone: 24,
    'blood-vessels': 24,
    'bone-marrow': 0, 
    ovaries: 6
};

const BLOOD_COMPATIBILITY = {
    'O-': ['O-', 'O+', 'A-', 'A+', 'B-', 'B+', 'AB-', 'AB+'],
    'O+': ['O+', 'A+', 'B+', 'AB+'],
    'A-': ['A-', 'A+', 'AB-', 'AB+'],
    'A+': ['A+', 'AB+'],
    'B-': ['B-', 'B+', 'AB-', 'AB+'],
    'B+': ['B+', 'AB+'],
    'AB-': ['AB-', 'AB+'],
    'AB+': ['AB+']
};

const RARE_BLOOD_GROUPS = ['AB-', 'B-', 'A-', 'O-'];

const PRIORITY_WEIGHTS = {
    critical: 100,
    high: 75,
    medium: 50,
    low: 25
};

// DOM Elements
const views = {
    userTypeSelection: document.getElementById('user-type-selection'),
    registration: document.getElementById('registration-view'),
    dashboard: document.getElementById('dashboard-view'),
    matching: document.getElementById('matching-view'),
    donors: document.getElementById('donors-view'),
    recipients: document.getElementById('recipients-view'),
    analytics: document.getElementById('analytics-view'),
    hospitals: document.getElementById('hospitals-view')
};

const elements = {
    mainNav: document.getElementById('main-nav'),
    logoutBtn: document.getElementById('logout-btn'),
    emergencyAlert: document.getElementById('emergency-alert'),
    emergencyCount: document.getElementById('emergency-count'),
    registrationTitle: document.getElementById('registration-title'),
    registrationForm: document.getElementById('registration-form'),
    prevStepBtn: document.getElementById('prev-step'),
    nextStepBtn: document.getElementById('next-step'),
    submitFormBtn: document.getElementById('submit-form'),
    backToSelectionBtn: document.getElementById('back-to-selection'),
    donorStatusSelect: document.getElementById('donor-status'),
    deceasedDetails: document.querySelector('.deceased-details'),
    organSelectionTitle: document.getElementById('organ-selection-title'),
    progressFill: document.getElementById('progress-fill'),
    currentStepSpan: document.getElementById('current-step'),
    totalStepsSpan: document.getElementById('total-steps'),
    bloodTypeDisplay: document.getElementById('blood-type-display'),
    registrationSummary: document.getElementById('registration-summary'),
    genderSelect: document.getElementById('gender'),
    bloodGroupSelect: document.getElementById('blood-group')
};

// Utility Functions
function showView(viewName) {
    Object.values(views).forEach(view => {
        if (view) view.classList.remove('active');
    });
    
    const targetView = views[viewName] || document.getElementById(viewName + '-view');
    if (targetView) {
        targetView.classList.add('active');
        currentView = viewName;
    }
    
    updateNavigation();
}

function updateNavigation() {
    const navButtons = document.querySelectorAll('.nav-btn');
    navButtons.forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.view === currentView) {
            btn.classList.add('active');
        }
    });
}

function saveToLocalStorage(key, data) {
    localStorage.setItem(key, JSON.stringify(data));
}

function getFromLocalStorage(key) {
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : null;
}

function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

function validateAadhar(aadhar) {
    return /^\d{12}$/.test(aadhar);
}

function isRareBloodGroup(bloodGroup) {
    return RARE_BLOOD_GROUPS.includes(bloodGroup);
}

// Advanced Matching Algorithms
class SmartMatcher {
    static calculateCompatibilityScore(donor, recipient) {
        let score = 0;
        let maxScore = 0;
        
        // Blood type compatibility (40% weight)
        maxScore += 40;
        if (this.isBloodTypeCompatible(donor.bloodGroup, recipient.bloodGroup)) {
            score += 40;
        }
        
        // Age compatibility (20% weight)
        maxScore += 20;
        const ageDiff = Math.abs(donor.age - recipient.age);
        if (ageDiff <= 5) score += 20;
        else if (ageDiff <= 10) score += 15;
        else if (ageDiff <= 15) score += 10;
        else if (ageDiff <= 20) score += 5;
        
        // Location proximity (15% weight)
        maxScore += 15;
        if (donor.city?.toLowerCase() === recipient.city?.toLowerCase()) {
            score += 15;
        } else if (donor.state?.toLowerCase() === recipient.state?.toLowerCase()) {
            score += 10;
        }
        
        // Weight compatibility (10% weight)
        maxScore += 10;
        const weightDiff = Math.abs((donor.weight || 70) - (recipient.weight || 70));
        if (weightDiff <= 10) score += 10;
        else if (weightDiff <= 20) score += 7;
        else if (weightDiff <= 30) score += 5;
        
        // Health status (10% weight)
        maxScore += 10;
        if (!donor.healthConditions || donor.healthConditions.trim() === '') {
            score += 10;
        } else if (donor.healthConditions.length < 100) {
            score += 5;
        }
        
        // Organ viability for deceased donors (5% weight)
        maxScore += 5;
        if (donor.donorStatus === 'living') {
            score += 5;
        } else if (donor.timeSinceDeath) {
            const viabilityHours = ORGAN_VIABILITY_HOURS[recipient.requiredOrgan] || 24;
            if (donor.timeSinceDeath <= viabilityHours * 0.5) {
                score += 5;
            } else if (donor.timeSinceDeath <= viabilityHours * 0.75) {
                score += 3;
            } else if (donor.timeSinceDeath <= viabilityHours) {
                score += 1;
            }
        }
        
        return Math.round((score / maxScore) * 100);
    }
    
    static isBloodTypeCompatible(donorType, recipientType) {
        return BLOOD_COMPATIBILITY[donorType]?.includes(recipientType) || false;
    }
    
    static findMatches(recipient) {
        const donors = registeredUsers.filter(user => 
            user.userType === 'donor' && 
            user.isActive &&
            user.organs?.includes(recipient.requiredOrgan)
        );
        
        const matches = donors.map(donor => {
            const score = this.calculateCompatibilityScore(donor, recipient);
            const priority = this.calculatePriority(recipient, donor);
            
            return {
                donor,
                recipient,
                score,
                priority,
                organ: recipient.requiredOrgan,
                urgency: this.calculateUrgency(recipient),
                viability: this.checkOrganViability(donor, recipient.requiredOrgan),
                distance: this.calculateDistance(donor, recipient)
            };
        });
        
        return matches.sort((a, b) => {
            // Sort by priority first, then by score
            if (a.priority !== b.priority) {
                return PRIORITY_WEIGHTS[b.priority] - PRIORITY_WEIGHTS[a.priority];
            }
            return b.score - a.score;
        });
    }
    
    static calculatePriority(recipient, donor) {
        let priority = 'low';
        
        // Critical conditions
        if (recipient.healthConditions?.toLowerCase().includes('critical') ||
            recipient.healthConditions?.toLowerCase().includes('emergency') ||
            (recipient.age < 18) ||
            isRareBloodGroup(recipient.bloodGroup)) {
            priority = 'critical';
        }
        // High priority conditions
        else if (recipient.healthConditions?.toLowerCase().includes('urgent') ||
                 (recipient.age > 65) ||
                 (donor.donorStatus === 'deceased' && donor.timeSinceDeath < 6)) {
            priority = 'high';
        }
        // Medium priority
        else if (recipient.healthConditions?.length > 100 ||
                 (donor.city === recipient.city)) {
            priority = 'medium';
        }
        
        return priority;
    }
    
    static calculateUrgency(recipient) {
        const urgencyFactors = [];
        
        if (recipient.age < 18) urgencyFactors.push('Pediatric case');
        if (recipient.age > 65) urgencyFactors.push('Senior patient');
        if (isRareBloodGroup(recipient.bloodGroup)) urgencyFactors.push('Rare blood type');
        if (recipient.healthConditions?.toLowerCase().includes('critical')) urgencyFactors.push('Critical condition');
        
        return urgencyFactors;
    }
    
    static checkOrganViability(donor, organ) {
        if (donor.donorStatus === 'living') return 'Excellent';
        
        const viabilityHours = ORGAN_VIABILITY_HOURS[organ] || 24;
        const timeSinceDeath = donor.timeSinceDeath || 0;
        
        if (timeSinceDeath <= viabilityHours * 0.5) return 'Excellent';
        if (timeSinceDeath <= viabilityHours * 0.75) return 'Good';
        if (timeSinceDeath <= viabilityHours) return 'Fair';
        return 'Poor';
    }
    
    static calculateDistance(donor, recipient) {
        // Simplified distance calculation
        if (donor.city === recipient.city) return 'Same city';
        if (donor.state === recipient.state) return 'Same state';
        return 'Different state';
    }
}

// User Type Selection
function initializeUserTypeSelection() {
    const userTypeCards = document.querySelectorAll('.user-type-card');
    
    userTypeCards.forEach(card => {
        card.addEventListener('click', () => {
            selectedUserType = card.dataset.type;
            showRegistrationForm();
        });
    });
    
    updateUserTypeStats();
}

function updateUserTypeStats() {
    const donorCount = registeredUsers.filter(u => u.userType === 'donor').length;
    const recipientCount = registeredUsers.filter(u => u.userType === 'recipient').length;
    const hospitalCount = registeredUsers.filter(u => u.userType === 'hospital').length;
    const successfulMatches = Math.floor(Math.min(donorCount, recipientCount) * 0.85);
    const successRate = donorCount > 0 ? Math.round((successfulMatches / donorCount) * 100) : 0;
    
    document.getElementById('donor-count').textContent = donorCount;
    document.getElementById('recipient-count').textContent = recipientCount;
    document.getElementById('hospital-count').textContent = hospitalCount;
    document.getElementById('match-success').textContent = successRate + '%';
}

function showRegistrationForm() {
    const titles = {
        donor: 'Register as Organ Donor',
        recipient: 'Register as Organ Recipient',
        doctor: 'Register as Medical Professional',
        hospital: 'Register as Hospital Administrator'
    };
    
    elements.registrationTitle.textContent = titles[selectedUserType] || 'Registration';
    elements.totalStepsSpan.textContent = maxSteps;
    
    updateFormSections();
    currentStep = 1;
    updateFormStep();
    showView('registration');
}

function updateFormSections() {
    const donorOnlyElements = document.querySelectorAll('.donor-only');
    const femaleOnlyElements = document.querySelectorAll('.female-only');
    
    // Show/hide donor-specific elements
    const isDonor = selectedUserType === 'donor';
    donorOnlyElements.forEach(element => {
        element.style.display = isDonor ? 'block' : 'none';
    });
    
    // Update organ selection title
    if (selectedUserType === 'recipient') {
        elements.organSelectionTitle.textContent = 'Required Organs & Medical Needs';
    } else {
        elements.organSelectionTitle.textContent = 'Organ Donation Preferences';
    }
    
    // Handle gender-specific organs
    elements.genderSelect.addEventListener('change', updateGenderSpecificOrgans);
    elements.bloodGroupSelect.addEventListener('change', updateBloodTypeDisplay);
}

function updateGenderSpecificOrgans() {
    const gender = elements.genderSelect.value;
    const femaleOnlyElements = document.querySelectorAll('.female-only');
    
    femaleOnlyElements.forEach(element => {
        if (gender === 'female') {
            element.classList.add('show');
        } else {
            element.classList.remove('show');
            const checkbox = element.querySelector('input[type="checkbox"]');
            if (checkbox) checkbox.checked = false;
        }
    });
}

function updateBloodTypeDisplay() {
    const bloodGroup = elements.bloodGroupSelect.value;
    if (bloodGroup) {
        elements.bloodTypeDisplay.textContent = `Blood Type: ${bloodGroup}`;
        if (isRareBloodGroup(bloodGroup)) {
            elements.bloodTypeDisplay.textContent += ' (Rare)';
            elements.bloodTypeDisplay.style.color = '#dc2626';
        } else {
            elements.bloodTypeDisplay.style.color = '#64748b';
        }
    } else {
        elements.bloodTypeDisplay.textContent = 'Blood Type: Not Selected';
        elements.bloodTypeDisplay.style.color = '#64748b';
    }
}

// Form Step Management
function updateFormStep() {
    const steps = document.querySelectorAll('.form-step');
    
    steps.forEach(step => step.classList.remove('active'));
    
    const currentStepElement = document.querySelector(`[data-step="${currentStep}"]`);
    if (currentStepElement) {
        currentStepElement.classList.add('active');
    }
    
    // Update progress bar
    const progressPercent = (currentStep / maxSteps) * 100;
    elements.progressFill.style.width = progressPercent + '%';
    elements.currentStepSpan.textContent = currentStep;
    
    // Update navigation buttons
    elements.prevStepBtn.style.display = currentStep > 1 ? 'block' : 'none';
    elements.nextStepBtn.style.display = currentStep < maxSteps ? 'block' : 'none';
    elements.submitFormBtn.style.display = currentStep === maxSteps ? 'block' : 'none';
    
    // Update summary on final step
    if (currentStep === maxSteps) {
        updateRegistrationSummary();
    }
}

function updateRegistrationSummary() {
    const formData = new FormData(elements.registrationForm);
    const summary = [];
    
    // Basic info
    if (formData.get('fullName')) {
        summary.push({ label: 'Name', value: formData.get('fullName') });
    }
    if (formData.get('age')) {
        summary.push({ label: 'Age', value: formData.get('age') + ' years' });
    }
    if (formData.get('bloodGroup')) {
        summary.push({ label: 'Blood Group', value: formData.get('bloodGroup') });
    }
    if (formData.get('city')) {
        summary.push({ label: 'Location', value: `${formData.get('city')}, ${formData.get('state')}` });
    }
    
    // Donor status
    if (formData.get('donorStatus')) {
        summary.push({ label: 'Status', value: formData.get('donorStatus').replace('-', ' ').toUpperCase() });
    }
    
    // Selected organs
    const organs = formData.getAll('organs');
    if (organs.length > 0) {
        summary.push({ label: 'Organs', value: organs.join(', ') });
    }
    
    // Blood donation
    if (formData.get('bloodDonation')) {
        summary.push({ label: 'Blood Donation', value: 'Yes' });
    }
    
    // Hospital
    if (formData.get('hospitalName')) {
        summary.push({ label: 'Hospital', value: formData.get('hospitalName') });
    }
    
    // Render summary
    elements.registrationSummary.innerHTML = summary.map(item => `
        <div class="summary-item">
            <div class="summary-label">${item.label}</div>
            <div class="summary-value">${item.value}</div>
        </div>
    `).join('');
}

function validateCurrentStep() {
    const currentStepElement = document.querySelector(`[data-step="${currentStep}"]`);
    const requiredInputs = currentStepElement.querySelectorAll('input[required], select[required], textarea[required]');
    
    for (let input of requiredInputs) {
        if (!input.value.trim()) {
            input.focus();
            showNotification(`Please fill in the ${input.previousElementSibling.textContent}`, 'error');
            return false;
        }
        
        // Special validations
        if (input.name === 'aadhar' && !validateAadhar(input.value)) {
            input.focus();
            showNotification('Please enter a valid 12-digit Aadhar number', 'error');
            return false;
        }
        
        if (input.name === 'pincode' && !/^\d{6}$/.test(input.value)) {
            input.focus();
            showNotification('Please enter a valid 6-digit pincode', 'error');
            return false;
        }
    }
    
    // Step-specific validations
    if (currentStep === 4) {
        const organs = document.querySelectorAll('input[name="organs"]:checked');
        const bloodDonation = document.querySelector('input[name="bloodDonation"]:checked');
        
        if (organs.length === 0 && !bloodDonation) {
            showNotification('Please select at least one organ or blood donation option', 'error');
            return false;
        }
    }
    
    if (currentStep === 6) {
        const requiredConsents = document.querySelectorAll('.consent-item.required input[type="checkbox"]');
        for (let consent of requiredConsents) {
            if (!consent.checked) {
                consent.focus();
                showNotification('Please provide all required consents to proceed', 'error');
                return false;
            }
        }
    }
    
    return true;
}

// Donor Status Management
function handleDonorStatusChange() {
    const donorStatus = elements.donorStatusSelect.value;
    const deceasedDetails = document.querySelector('.deceased-details');
    
    if (donorStatus === 'deceased' || donorStatus === 'diseased') {
        deceasedDetails.style.display = 'block';
        
        // Make deceased-specific fields required
        const deceasedInputs = deceasedDetails.querySelectorAll('input, select');
        deceasedInputs.forEach(input => {
            if (['timeSinceDeath', 'familyConsent', 'familyContact', 'familyRelation'].includes(input.name)) {
                input.required = true;
            }
        });
    } else {
        deceasedDetails.style.display = 'none';
        
        // Remove required attribute
        const deceasedInputs = deceasedDetails.querySelectorAll('input, select');
        deceasedInputs.forEach(input => {
            input.required = false;
        });
    }
}

// Form Submission
function handleFormSubmission(event) {
    event.preventDefault();
    
    if (!validateCurrentStep()) {
        return;
    }
    
    const formData = new FormData(elements.registrationForm);
    const userData = {
        id: generateId(),
        userType: selectedUserType,
        registrationDate: new Date().toISOString(),
        isActive: true,
        matchingScore: 0,
        lastUpdated: new Date().toISOString()
    };
    
    // Process form data
    for (let [key, value] of formData.entries()) {
        if (key === 'organs') {
            if (!userData.organs) userData.organs = [];
            userData.organs.push(value);
        } else {
            userData[key] = value;
        }
    }
    
    // Calculate BMI
    if (userData.weight && userData.height) {
        const heightInM = userData.height / 100;
        userData.bmi = (userData.weight / (heightInM * heightInM)).toFixed(1);
    }
    
    // Mark rare blood groups
    if (userData.bloodGroup && isRareBloodGroup(userData.bloodGroup)) {
        userData.isRareBloodGroup = true;
    }
    
    // Calculate initial matching score for recipients
    if (selectedUserType === 'recipient') {
        userData.waitingListPriority = SmartMatcher.calculatePriority(userData, {});
    }
    
    // Add to registered users
    registeredUsers.push(userData);
    saveToLocalStorage('smartmatch_users', registeredUsers);
    
    // Set current user
    currentUser = userData;
    saveToLocalStorage('smartmatch_current_user', currentUser);
    
    showNotification('Registration completed successfully! Welcome to SmartMatch.', 'success');
    
    // Show dashboard
    setTimeout(() => {
        showDashboard();
        
        // Run initial matching if recipient
        if (selectedUserType === 'recipient') {
            setTimeout(() => {
                runSmartMatching();
            }, 1000);
        }
    }, 1500);
}

// Dashboard Management
function showDashboard() {
    if (!currentUser) {
        showView('userTypeSelection');
        return;
    }
    
    elements.mainNav.style.display = 'flex';
    elements.logoutBtn.style.display = 'block';
    
    updateDashboardStats();
    updateUserInfo();
    updateEmergencyAlerts();
    loadRecentMatches();
    loadCriticalAlerts();
    
    showView('dashboard');
}

function updateDashboardStats() {
    const criticalMatches = findCriticalMatches();
    const matchAccuracy = calculateMatchAccuracy();
    const activeUsers = registeredUsers.filter(u => u.isActive).length;
    const avgWaitTime = calculateAverageWaitTime();
    
    document.getElementById('critical-matches').textContent = criticalMatches;
    document.getElementById('match-score').textContent = matchAccuracy + '%';
    document.getElementById('active-users').textContent = activeUsers;
    document.getElementById('avg-wait-time').textContent = avgWaitTime;
}

function updateUserInfo() {
    if (currentUser) {
        document.getElementById('user-name').textContent = currentUser.fullName || 'User';
        
        const statusBadge = document.getElementById('user-status');
        const statusText = {
            donor: 'Active Donor',
            recipient: 'Waiting List',
            doctor: 'Medical Professional',
            hospital: 'Hospital Network'
        };
        statusBadge.textContent = statusText[currentUser.userType] || 'User';
        
        // Update status badge color based on user type
        statusBadge.className = 'status-badge';
        if (currentUser.userType === 'recipient') {
            statusBadge.style.background = 'linear-gradient(135deg, #fef3c7, #fde68a)';
            statusBadge.style.color = '#92400e';
        }
    }
}

function updateEmergencyAlerts() {
    const emergencyCount = findCriticalMatches();
    elements.emergencyCount.textContent = emergencyCount;
    
    if (emergencyCount > 0) {
        elements.emergencyAlert.style.display = 'flex';
    } else {
        elements.emergencyAlert.style.display = 'none';
    }
}

function findCriticalMatches() {
    const recipients = registeredUsers.filter(u => u.userType === 'recipient' && u.isActive);
    let criticalCount = 0;
    
    recipients.forEach(recipient => {
        if (recipient.isRareBloodGroup || 
            recipient.age < 18 || 
            recipient.healthConditions?.toLowerCase().includes('critical')) {
            criticalCount++;
        }
    });
    
    return criticalCount;
}

function calculateMatchAccuracy() {
    // Simulate match accuracy based on system performance
    const totalUsers = registeredUsers.length;
    const baseAccuracy = 85;
    const bonusAccuracy = Math.min(totalUsers * 0.5, 13);
    return Math.round(baseAccuracy + bonusAccuracy);
}

function calculateAverageWaitTime() {
    // Simulate average wait time calculation
    const recipients = registeredUsers.filter(u => u.userType === 'recipient');
    if (recipients.length === 0) return '0.0';
    
    const avgDays = Math.max(1.0, 7.5 - (recipients.length * 0.1));
    return avgDays.toFixed(1);
}

function loadRecentMatches() {
    const recentMatchesContainer = document.getElementById('recent-matches');
    
    // Simulate recent matches
    const matches = [
        { donor: 'Anonymous Donor', recipient: 'Patient #1234', organ: 'Kidney', score: 95, time: '2 hours ago' },
        { donor: 'Anonymous Donor', recipient: 'Patient #5678', organ: 'Liver', score: 88, time: '5 hours ago' },
        { donor: 'Anonymous Donor', recipient: 'Patient #9012', organ: 'Heart', score: 92, time: '1 day ago' }
    ];
    
    if (matches.length === 0) {
        recentMatchesContainer.innerHTML = '<p class="empty-state">No recent matches</p>';
        return;
    }
    
    recentMatchesContainer.innerHTML = matches.map(match => `
        <div class="match-item">
            <div class="match-score ${getScoreClass(match.score)}">${match.score}%</div>
            <div class="match-info">
                <div class="match-title">${match.organ} Match</div>
                <div class="match-details">
                    <span class="match-detail">Donor: ${match.donor}</span>
                    <span class="match-detail">Recipient: ${match.recipient}</span>
                    <span class="match-detail">${match.time}</span>
                </div>
            </div>
        </div>
    `).join('');
}

function loadCriticalAlerts() {
    const alertsContainer = document.getElementById('critical-alerts');
    const alertCount = document.getElementById('alert-count');
    
    // Simulate critical alerts
    const alerts = [];
    
    registeredUsers.forEach(user => {
        if (user.userType === 'recipient' && user.isActive) {
            if (user.isRareBloodGroup) {
                alerts.push({
                    type: 'rare-blood',
                    message: `Rare blood type ${user.bloodGroup} recipient waiting`,
                    priority: 'critical',
                    time: '1 hour ago'
                });
            }
            if (user.age < 18) {
                alerts.push({
                    type: 'pediatric',
                    message: `Pediatric patient (age ${user.age}) needs ${user.organs?.[0] || 'organ'}`,
                    priority: 'high',
                    time: '3 hours ago'
                });
            }
        }
        
        if (user.userType === 'donor' && user.donorStatus === 'deceased' && user.timeSinceDeath < 6) {
            alerts.push({
                type: 'time-critical',
                message: `Deceased donor organs available - ${6 - user.timeSinceDeath} hours remaining`,
                priority: 'critical',
                time: 'Just now'
            });
        }
    });
    
    alertCount.textContent = alerts.length;
    
    if (alerts.length === 0) {
        alertsContainer.innerHTML = '<p class="empty-state">No critical alerts</p>';
        return;
    }
    
    alertsContainer.innerHTML = alerts.slice(0, 5).map(alert => `
        <div class="alert-item">
            <div class="match-priority ${alert.priority}"></div>
            <div class="alert-content">
                <div class="alert-message">${alert.message}</div>
                <div class="alert-time">${alert.time}</div>
            </div>
        </div>
    `).join('');
}

function getScoreClass(score) {
    if (score >= 90) return 'excellent';
    if (score >= 75) return 'good';
    if (score >= 60) return 'fair';
    return 'poor';
}

// Smart Matching Engine
function runSmartMatching() {
    const recipients = registeredUsers.filter(u => u.userType === 'recipient' && u.isActive);
    matchingResults = [];
    
    recipients.forEach(recipient => {
        if (recipient.organs && recipient.organs.length > 0) {
            recipient.organs.forEach(organ => {
                const recipientForOrgan = { ...recipient, requiredOrgan: organ };
                const matches = SmartMatcher.findMatches(recipientForOrgan);
                matchingResults.push(...matches);
            });
        }
    });
    
    displayMatchingResults();
    showNotification(`Found ${matchingResults.length} potential matches`, 'success');
}

function displayMatchingResults() {
    const resultsContainer = document.getElementById('matching-results');
    
    if (matchingResults.length === 0) {
        resultsContainer.innerHTML = `
            <div class="empty-state">
                <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                    <circle cx="12" cy="12" r="10"/>
                    <path d="M12 6v6l4 2"/>
                </svg>
                <h3>No matches found</h3>
                <p>Run the matching algorithm to find compatible donor-recipient pairs</p>
            </div>
        `;
        return;
    }
    
    resultsContainer.innerHTML = matchingResults.map(match => `
        <div class="match-card">
            <div class="match-score ${getScoreClass(match.score)}">${match.score}%</div>
            <div class="match-info">
                <div class="match-title">${match.organ.charAt(0).toUpperCase() + match.organ.slice(1)} Match</div>
                <div class="match-details">
                    <span class="match-detail">Blood: ${match.donor.bloodGroup} → ${match.recipient.bloodGroup}</span>
                    <span class="match-detail">Age: ${match.donor.age} → ${match.recipient.age}</span>
                    <span class="match-detail">Location: ${match.distance}</span>
                    <span class="match-detail">Viability: ${match.viability}</span>
                </div>
                <div class="match-urgency">
                    ${match.urgency.map(factor => `<span class="urgency-factor">${factor}</span>`).join('')}
                </div>
            </div>
            <div class="match-priority ${match.priority}">${match.priority.toUpperCase()}</div>
            <div class="match-actions">
                <button class="btn btn-sm btn-primary" onclick="initiateMatch('${match.donor.id}', '${match.recipient.id}', '${match.organ}')">
                    Initiate Match
                </button>
                <button class="btn btn-sm btn-secondary" onclick="viewMatchDetails('${match.donor.id}', '${match.recipient.id}')">
                    Details
                </button>
            </div>
        </div>
    `).join('');
}

function initiateMatch(donorId, recipientId, organ) {
    showNotification(`Initiating match process for ${organ} transplant`, 'success');
    
    // In a real system, this would trigger the medical team notification
    setTimeout(() => {
        showNotification('Medical team has been notified. Match process initiated.', 'success');
    }, 2000);
}

function viewMatchDetails(donorId, recipientId) {
    const donor = registeredUsers.find(u => u.id === donorId);
    const recipient = registeredUsers.find(u => u.id === recipientId);
    
    if (donor && recipient) {
        showNotification(`Viewing detailed compatibility analysis for match`, 'info');
        // In a real system, this would open a detailed modal
    }
}

// Navigation Management
function initializeNavigation() {
    const navButtons = document.querySelectorAll('.nav-btn');
    
    navButtons.forEach(button => {
        button.addEventListener('click', () => {
            const targetView = button.dataset.view;
            showView(targetView);
            
            // Load view-specific data
            if (targetView === 'matching') {
                loadMatchingView();
            } else if (targetView === 'donors') {
                loadDonorsView();
            } else if (targetView === 'recipients') {
                loadRecipientsView();
            }
        });
    });
}

function loadMatchingView() {
    // Initialize matching filters
    const refreshBtn = document.getElementById('refresh-matches');
    const runMatchingBtn = document.getElementById('run-matching');
    
    if (refreshBtn) {
        refreshBtn.addEventListener('click', () => {
            displayMatchingResults();
            showNotification('Matching results refreshed', 'info');
        });
    }
    
    if (runMatchingBtn) {
        runMatchingBtn.addEventListener('click', runSmartMatching);
    }
}

function loadDonorsView() {
    const donorsContainer = document.getElementById('donors-container');
    const donors = registeredUsers.filter(u => u.userType === 'donor');
    
    if (donors.length === 0) {
        donorsContainer.innerHTML = `
            <div class="empty-state">
                <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
                </svg>
                <h3>No donors registered</h3>
                <p>Registered donors will appear here</p>
            </div>
        `;
        return;
    }
    
    donorsContainer.innerHTML = donors.map(donor => `
        <div class="donor-card">
            <div class="donor-info">
                <h4>${donor.anonymousDonation ? 'Anonymous Donor' : donor.fullName}</h4>
                <div class="donor-details">
                    <span>Age: ${donor.age}</span>
                    <span>Blood: ${donor.bloodGroup}</span>
                    <span>Status: ${donor.donorStatus}</span>
                    <span>Location: ${donor.city}, ${donor.state}</span>
                </div>
                <div class="donor-organs">
                    ${(donor.organs || []).map(organ => `<span class="organ-tag">${organ}</span>`).join('')}
                </div>
            </div>
            <div class="donor-status ${donor.isActive ? 'active' : 'inactive'}">
                ${donor.isActive ? 'Active' : 'Inactive'}
            </div>
        </div>
    `).join('');
}

function loadRecipientsView() {
    const recipientsContainer = document.getElementById('recipients-container');
    const recipients = registeredUsers.filter(u => u.userType === 'recipient');
    
    if (recipients.length === 0) {
        recipientsContainer.innerHTML = `
            <div class="empty-state">
                <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/>
                    <circle cx="9" cy="7" r="4"/>
                    <path d="M22 21v-2a4 4 0 0 0-3-3.87"/>
                </svg>
                <h3>No recipients registered</h3>
                <p>Patients waiting for organs will appear here</p>
            </div>
        `;
        return;
    }
    
    recipientsContainer.innerHTML = recipients.map(recipient => `
        <div class="recipient-card">
            <div class="recipient-info">
                <h4>${recipient.fullName}</h4>
                <div class="recipient-details">
                    <span>Age: ${recipient.age}</span>
                    <span>Blood: ${recipient.bloodGroup}${recipient.isRareBloodGroup ? ' (Rare)' : ''}</span>
                    <span>Priority: ${recipient.waitingListPriority || 'Medium'}</span>
                    <span>Location: ${recipient.city}, ${recipient.state}</span>
                </div>
                <div class="recipient-needs">
                    ${(recipient.organs || []).map(organ => `<span class="need-tag">${organ}</span>`).join('')}
                </div>
            </div>
            <div class="recipient-priority ${recipient.waitingListPriority || 'medium'}">
                ${(recipient.waitingListPriority || 'medium').toUpperCase()}
            </div>
        </div>
    `).join('');
}

// Logout
function handleLogout() {
    currentUser = null;
    localStorage.removeItem('smartmatch_current_user');
    
    elements.mainNav.style.display = 'none';
    elements.logoutBtn.style.display = 'none';
    elements.emergencyAlert.style.display = 'none';
    
    showView('userTypeSelection');
    showNotification('Logged out successfully', 'success');
}

// Notifications
function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.innerHTML = `
        <div class="notification-content">
            <span class="notification-message">${message}</span>
            <button class="notification-close" onclick="this.parentElement.parentElement.remove()">×</button>
        </div>
    `;
    
    Object.assign(notification.style, {
        position: 'fixed',
        top: '20px',
        right: '20px',
        padding: '16px 20px',
        borderRadius: '12px',
        color: 'white',
        fontWeight: '500',
        zIndex: '10000',
        transform: 'translateX(100%)',
        transition: 'transform 0.3s ease',
        maxWidth: '400px',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.2)'
    });
    
    const colors = {
        success: 'linear-gradient(135deg, #059669, #10b981)',
        error: 'linear-gradient(135deg, #dc2626, #ef4444)',
        warning: 'linear-gradient(135deg, #f59e0b, #fbbf24)',
        info: 'linear-gradient(135deg, #2563eb, #3b82f6)'
    };
    notification.style.background = colors[type] || colors.info;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.style.transform = 'translateX(0)';
    }, 100);
    
    setTimeout(() => {
        notification.style.transform = 'translateX(100%)';
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 300);
    }, 5000);
}

// Event Listeners
function initializeEventListeners() {
    initializeUserTypeSelection();
    initializeNavigation();
    
    elements.backToSelectionBtn.addEventListener('click', () => {
        showView('userTypeSelection');
    });
    
    elements.nextStepBtn.addEventListener('click', () => {
        if (validateCurrentStep()) {
            currentStep++;
            updateFormStep();
        }
    });
    
    elements.prevStepBtn.addEventListener('click', () => {
        currentStep--;
        updateFormStep();
    });
    
    elements.registrationForm.addEventListener('submit', handleFormSubmission);
    elements.donorStatusSelect.addEventListener('change', handleDonorStatusChange);
    elements.logoutBtn.addEventListener('click', handleLogout);
}

// Application Initialization
function initializeApp() {
    currentUser = getFromLocalStorage('smartmatch_current_user');
    
    if (currentUser) {
        showDashboard();
    } else {
        showView('userTypeSelection');
    }
    
    initializeEventListeners();
    
    // Initialize with some sample data for demonstration
    if (registeredUsers.length === 0) {
        initializeSampleData();
    }
    
    console.log('SmartMatch Organ Donor Matcher initialized successfully');
}

function initializeSampleData() {
    const sampleUsers = [
        {
            id: 'donor1',
            userType: 'donor',
            fullName: 'Anonymous Donor 1',
            age: 35,
            bloodGroup: 'O+',
            city: 'Mumbai',
            state: 'Maharashtra',
            organs: ['kidney', 'liver'],
            donorStatus: 'living',
            isActive: true,
            anonymousDonation: true,
            registrationDate: new Date(Date.now() - 86400000).toISOString()
        },
        {
            id: 'recipient1',
            userType: 'recipient',
            fullName: 'Patient #1234',
            age: 42,
            bloodGroup: 'O+',
            city: 'Mumbai',
            state: 'Maharashtra',
            organs: ['kidney'],
            healthConditions: 'Chronic kidney disease',
            waitingListPriority: 'high',
            isActive: true,
            registrationDate: new Date(Date.now() - 172800000).toISOString()
        },
        {
            id: 'donor2',
            userType: 'donor',
            fullName: 'Anonymous Donor 2',
            age: 28,
            bloodGroup: 'AB-',
            city: 'Delhi',
            state: 'Delhi',
            organs: ['heart', 'lungs'],
            donorStatus: 'deceased',
            timeSinceDeath: 2,
            familyConsent: 'yes',
            isActive: true,
            isRareBloodGroup: true,
            anonymousDonation: true,
            registrationDate: new Date(Date.now() - 3600000).toISOString()
        }
    ];
    
    registeredUsers.push(...sampleUsers);
    saveToLocalStorage('smartmatch_users', registeredUsers);
}

// Start the application
document.addEventListener('DOMContentLoaded', initializeApp);

// Export functions for testing
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        SmartMatcher,
        validateAadhar,
        isRareBloodGroup,
        ORGAN_VIABILITY_HOURS,
        BLOOD_COMPATIBILITY
    };
}
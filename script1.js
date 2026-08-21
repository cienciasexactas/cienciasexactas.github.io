    <!-- SCRIPT DE SUBSCRIÇÃO DA NEWSLETTER -->
    <script>
    function subscreverNewsletter(event) {
    event.preventDefault();

    const emailInput = document.getElementById('newsletter-email');
    const email = emailInput.value;

    // Dados que serão enviados para o modelo de e-mail
    const templateParams = {
        user_email: email
    };

    // Envia o e-mail usando o EmailJS
    emailjs.send('SEU_SERVICE_ID', 'SEU_TEMPLATE_ID', templateParams)
        .then(function(response) {
            alert(`Obrigado por se inscrever! Enviamos uma confirmação para: ${email}`);
            emailInput.value = '';
        }, function(error) {
            alert('Ocorreu um erro ao subscrever. Por favor, tente novamente.');
            console.error('Erro EmailJS:', error);
        });
    }
    </script>

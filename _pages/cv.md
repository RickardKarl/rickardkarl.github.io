---
layout: archive
title: "CV"
permalink: /cv/
author_profile: true
redirect_from:
  - /resume
---

{% include base_path %}

Education
======
* B.Sc. in Engineering Physics, Chalmers University of Technology University, 2019
* Exchange student, Delft University of Technology, 2020
* M.Sc. in Engineering Mathematics, Chalmers University of Technology University, 2021 (expected)


Work experience
======

* Summer 2020: Research Assistant
  * Delft University of Technology
  * Performed research in surrogate-based optimisation for discrete problems. Studied various acquistion functions. Also investigated the effect of continous versus discrete surrogate models, which resulted in a published paper presented at BNAIC/BeneLearn (2020).
  * Supervisor: Assistant professor Laurens Bliek (now at Eindhoven University of Technology)

* July - Dec 2020: Software Developer Consultant
  * Apro Translations AB
  * Developed software for robotic process automation to reduce manual labour in accepting job requests on a web portal, sending emails and automating actions in a desktop application.

* Summer 2019: Data Analyst Intern
  * NASA Goddard Space Flight Center
  * Developed a software utility for data visualization and editing of data used in very-long-baseline interferometry.

* Jan - June 2019: Undergraduate Student Researcher
  * Chalmers University of Technology
  * Built and tested a deep learning model (FCN, CNN) in Tensorflow that predicted properties of scattering gamma rays in subatomic experiments.
  * Supervisor: Associate professor Andreas Martin Heinz

Skills
======
* Programming
  * Python, Java, C, R, Matlab, 
* Technologies
  * Tensorflow, PyTorch, NumPy, Pandas, SQL, Git, Docker, Kubernetes, Azure
* Languages
  * Swedish (Native), 
  * English (Fluent)
  * Polish (Intermediate)
  * French (Basic)

Publications
======
  <ul>{% for post in site.publications %}
    {% include archive-single-cv.html %}
  {% endfor %}</ul>
  
Talks
======
  <ul>{% for post in site.talks %}
    {% include archive-single-talk-cv.html %}
  {% endfor %}</ul>
  
Teaching
======
  <ul>{% for post in site.teaching %}
    {% include archive-single-cv.html %}
  {% endfor %}</ul>
  